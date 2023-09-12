import assert from "assert";
import fs from "fs-extra";
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
    numPageMax = 0;
    numPageMin = 0;
    headless = true;
    useGPU = false;
    pageOptions = {};
    #launchCallbacks = [];
    #firstPage = true;
    closed = false;

    constructor(parent, options) {
        assert(parent instanceof Pool, "Browser parent must be Pool");
        this.parent = parent;
        assert(_.isObject(options), "Browser options must provided");
        const { numPageMax, numPageMin, headless = true, useGPU = false, debug, pageOptions = {} } = options;
        assert(_.isFinite(numPageMax), "Browser options.numPageMax must be number");
        assert(_.isFinite(numPageMin), "Browser options.numPageMin must be number");
        assert(headless == "new" || _.isBoolean(headless), "Browser options.headless must be 'new' or boolean");
        assert(_.isBoolean(useGPU), "Browser options.useGPU must be boolean");
        assert(_.isBoolean(debug), "Browser options.debug must be boolean");
        assert(_.isObject(pageOptions), "Browser options.pageOptions must be object");
        this.numPageMax = numPageMax;
        this.numPageMin = numPageMin;
        this.pageOptions = pageOptions;
        this.headless = headless;
        this.useGPU = useGPU;
        this.debug = debug;
    }

    async init() {
        await fs.ensureDir("./tmp");
        this.target = await puppeteer.launch({
            headless: this.headless,
            channel: "chrome",
            ignoreHTTPSErrors: true,
            timeout: 30000,
            dumpio: this.debug,
            pipe: true,
            userDataDir: "./tmp",
            args: this.#generateArgs()
        });
        this.target.once("disconnected", () => {
            this.close()
                .catch(err => console.error(`browser ${this.id} close error:`, err));
        });
        this.#createPool();
        await this.#warmup();
        this.#launchCallbacks.forEach(fn => fn());
        this.#setState(Browser.STATE.READY);
    }

    #createPool() {
        this.#pagePool = genericPool.createPool({
            create: this.#createPage.bind(this),
            destroy: target => target.close(),
            validate: target => target.isReady()
        }, {
            max: this.numPageMax,
            min: this.numPageMin,
            autostart: false
        });
        this.#pagePool.on('factoryCreateError', (error) => {
            const client = this.#pagePool._waitingClientsQueue.dequeue();
            if(!client) return console.error(error);
            client.reject(error);
        });
    }

    async #warmup() {
        this.#pagePool.start();
        await this.#pagePool.ready();
    }

    async acquirePage() {
        return await this.#pagePool.acquire();
    }

    async #createPage() {
        if(!this.target)
            await new Promise(resolve => this.#launchCallbacks.push(resolve));
        const page = new Page(this, { ...this.pageOptions, _firstPage: this.firstPage });
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

    #generateArgs() {
        return [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            util.isLinux() ? "--single-process" : "--process-per-tab",
            "--disable-dev-shm-usage",
            "--disable-extensions",
            "--no-zygote",
            "--shm-size=5gb",
            "--hide-scrollbars",  // 隐藏滚动条
            "--mute-audio",  // 静音
            "--disable-web-security",  // 禁用Web安全策略
            "--disable-dinosaur-easter-egg",  // 禁用小恐龙彩蛋
            "--disable-ipc-flooding-protection",  // 禁用IPC泛洪保护
            "--disable-backgrounding-occluded-windows",  // 禁用降低后台标签页优先级
            "--disable-background-timer-throttling",  // 禁用后台标签页定时器节流
            "--disable-renderer-backgrounding",  // 禁用渲染器进程后台化
            "--disable-component-update",  // 禁用组件更新
            "--disable-breakpad",  // 禁用崩溃报告系统
            "--no-pings",  // 禁用ping元素
            "--disable-infobars",  // 禁用信息栏
            "--disable-session-crashed-bubble",  // 禁用会话崩溃气泡
            "--font-render-hinting=none",  // 禁用字形提示以原始轮廓渲染
            "--no-default-browser-check",  // 禁用默认浏览器检查
            "--block-new-web-contents",  // 禁用弹窗
            "--noerrdialogs",  // 禁用错误对话框
            // "--enable-leak-detection",  // 启用内存泄露检测
            "--enable-smooth-scrolling",  // 启用平滑滚动
            "--deterministic-mode",  //确定性模式标志
            "--disable-threaded-animation",  //禁用线程动画
            "--enable-surface-synchronization",  //启用表面同步
            "--disable-threaded-scrolling",  //禁用线程滚动
            "--disable-filter-imaging",  //禁用图像检查
            "--disable-new-content-rendering-timeout",  //禁用新内容渲染超时时间
            "--disable-image-animation-resync",  //禁用图像动画再同步
            "--enable-begin-frame-control",  //开启beginFrame控制
            "--run-all-compositor-stages-before-draw",  //在呈现所有数据之前防止绘制下一帧
            ...(this.useGPU ? [
                "--enable-gpu",
                "--use-angle",
                // "--enable-unsafe-webgpu",
                // "--ignore-gpu-blocklist",
                // "--gpu-no-context-lost",
                // "--enable-gpu-compositing",
                // "--enable-gpu-rasterization",
                // "--disable-gpu-driver-bug-workarounds",
                // "--enable-native-gpu-memory-buffers",
                // "--enable-accelerated-2d-canvas",
                // "--enable-accelerated-jpeg-decoding",
                // "--enable-accelerated-mjpeg-decode",
                // "--enable-accelerated-video-decode",
                // "--enable-zero-copy",
                // "--enable-oop-rasterization",
                // "--enable-gpu-memory-buffer-video-frames",
                // // "--disable-features=PaintHolding",
                // "--enable-features=VaapiVideoDecoder,RawDraw,CanvasOopRasterization,PlatformHEVCDecoderSupport"
            ] : [
                "--disable-gpu"  // 禁用GPU
            ])
        ];
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
        this.#firstPage = false;
        return true;
    }

}