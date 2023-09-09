import assert from "assert";
import puppeteer, { Browser as _Browser } from "puppeteer-core";
import genericPool, { Pool as _Pool } from "generic-pool";
import _ from "lodash";

import Pool from "./Pool.js";
import Page from "./Page.js";
import util from "./util.js";

let browserIndex = 1;

export default class Browser {

    static STATE = {
        UNINITIALIZED: Symbol("UNINITIALIZED"),
        READY: Symbol("READY"),
        UNAVAILABLED: Symbol("UNAVAILABLED"),
        CLOSED: Symbol("CLOSED")
    };

    id = `Browser@${browserIndex++}`;
    /** @type {Browser.STATE} */
    state = Browser.STATE.READY;
    /** @type {Pool} */
    parent = null;
    /** @type {_Pool} */
    #pagePool;
    /** @type {_Browser} */
    target = null;
    useGPU = false;
    pageOptions = {};
    #launchCallbacks = [];
    #firstPage = true;
    closed = false;

    constructor(parent, options) {
        assert(parent instanceof Pool, "Browser parent must be Pool");
        this.parent = parent;
        assert(_.isObject(options), "Browser options must provided");
        const { numPageMax, numPageMin, useGPU = false, pageOptions = {} } = options;
        assert(_.isFinite(numPageMax), "Browser options.numPageMax must be number");
        assert(_.isFinite(numPageMin), "Browser options.numPageMin must be number");
        assert(_.isBoolean(useGPU), "Browser options.useGPU must be boolean");
        assert(_.isObject(pageOptions), "Browser options.pageOptions must be object");
        this.pageOptions = pageOptions;
        this.useGPU = useGPU;
        this.#pagePool = genericPool.createPool({
            create: this.#createPage.bind(this),
            destroy: target => target.close(),
            validate: target => target.isReady()
        }, {
            max: numPageMax,
            min: numPageMin,
            autostart: false
        });
        this.#pagePool.on('factoryCreateError', (error) => {
            const client = this.#pagePool._waitingClientsQueue.dequeue();
            if(!client) return console.error(error);
            client.reject(error);
        });
    }

    async init() {
        this.target = await puppeteer.launch({
            headless: "new",
            channel: "chrome",
            ignoreHTTPSErrors: true,
            timeout: 30000,
            dumpio: true,
            pipe: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                util.isLinux() ? "--single-process" : "--process-per-tab",
                "--disable-dev-shm-usage",
                "--disable-extensions",
                "--no-zygote",
                "--shm-size=5gb",
                "--hide-scrollbars",
                "--mute-audio",
                "--disable-web-security",
                "--disable-timeouts-for-profiling",
                "--disable-dinosaur-easter-egg",
                "--disable-ipc-flooding-protection",
                "--disable-backgrounding-occluded-windows",
                "--disable-background-timer-throttling",
                "--disable-renderer-backgrounding",
                "--disable-backing-store-limit",
                "--disable-component-update",
                "--intensive-wake-up-throttling-policy=0",
                "--disable-popup-blocking",
                "--disable-sync",
                "--disable-breakpad",
                "--no-pings",
                "--font-render-hinting=none",
                "--no-default-browser-check",
                "--enable-crash-reporter",
                "--block-new-web-contents",
                "--noerrdialogs",
                "--enable-leak-detection",
                ...(this.useGPU ? [
                    "--enable-unsafe-webgpu",
                    "--ignore-gpu-blocklist",
                    "--gpu-no-context-lost",
                    "--enable-gpu-compositing",
                    "--enable-gpu-rasterization",
                    "--disable-gpu-driver-bug-workarounds",
                    "--enable-native-gpu-memory-buffers",
                    "--enable-accelerated-2d-canvas",
                    "--enable-accelerated-jpeg-decoding",
                    "--enable-accelerated-mjpeg-decode",
                    "--enable-accelerated-video-decode",
                    "--enable-zero-copy",
                    "--enable-oop-rasterization",
                    "--enable-gpu-memory-buffer-video-frames",
                    // "--disable-features=PaintHolding",
                    "--enable-features=VaapiVideoDecoder,RawDraw,CanvasOopRasterization,PlatformHEVCDecoderSupport"
                ] : [
                    "--disable-gpu"
                ]),
                "--deterministic-mode",
                "--enable-surface-synchronization",
                "--disable-threaded-animation",
                "--disable-threaded-scrolling",
                "--disable-filter-imaging",
                "--disable-new-content-rendering-timeout",
                "--disable-image-animation-resync",
                // "--enable-features=SurfaceSynchronization",
                "--enable-begin-frame-control",
                "--run-all-compositor-stages-before-draw"
            ]
        });
        await this.warmup();
        this.#launchCallbacks.forEach(fn => fn());
        this.#setState(Browser.STATE.READY);
    }

    async warmup() {
        this.#pagePool.start();
        await this.#pagePool.ready();
    }

    async acquirePage() {
        return await this.#pagePool.acquire();
    }

    async #createPage() {
        if(!this.target)
            await new Promise(resolve => this.#launchCallbacks.push(resolve));
        const page = new Page(this, { ...this.pageOptions, firstPage: this.firstPage });
        await page.init();
        return page;
    }

    async releasePage(target) {
        await this.#pagePool.release(target);
    }

    async closePage(target) {
        await this.#pagePool.destroy(target);
    }

    async release() {
        await this.parent.releaseBrowser(this);
        this.#setState(Browser.STATE.READY);
    }

    async close() {
        if(this.isClosed())
            return;
        this.#setState(Browser.STATE.CLOSED);
        await this.#pagePool.clear();
        await this.parent.closeBrowser(this);
        if(!this.target || this.target.isClosed())
            return;
        this.target.close();
        this.target = null;
    }

    async getPageCount() {
        return (await this.target.pages()).length;
    }

    #setState(state) {
        assert(_.isSymbol(state), "state must be Symbol");
        this.state = state;
    }

    isUninitialized() {
        return this.state == Browser.STATE.UNINITIALIZED;
    }

    isReady() {
        return this.state == Browser.STATE.READY;
    }

    isUnavailabled() {
        return this.state == Browser.STATE.UNAVAILABLED;
    }

    isClosed() {
        return this.state == Browser.STATE.CLOSED;
    }

    isBusy() {
        return this.#pagePool.borrowed >= this.#pagePool.max;
    }

    get firstPage() {
        if(!this.#firstPage)
            return false;
        this.#firstPage = true;
        return true;
    }

}