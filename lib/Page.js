import assert from "assert";
import { Page as _Page, CDPSession } from "puppeteer-core";
import _ from "lodash";

import Browser from "./Browser.js";

let pageIndex = 1;

export default class Page {

    static STATE = {
        UNINITIALIZED: Symbol("UNINITIALIZED"),
        READY: Symbol("READY"),
        WORKING: Symbol("WORKING"),
        UNAVAILABLED: Symbol("UNAVAILABLED"),
        CLOSED: Symbol("CLOSED")
    };

    id = `Page@${pageIndex++}`;
    /** @type {Page.STATE} */
    state = Page.STATE.UNINITIALIZED;
    /** @type {Browser} */
    parent = null;
    /** @type {_Page} */
    target = null;
    width = 0;
    height = 0;
    /** @type {CDPSession} */
    #cdpSession = null;
    #frameCallback = null;
    #padCallback = null;
    #frameStack = [];
    #lastFrameTimestamp = 0;
    #firstPage = false;

    constructor(parent, options) {
        assert(parent instanceof Browser, "Page parent must be Browser");
        this.parent = parent;
        assert(_.isObject(options), "Page options must provided");
        const { width = 1920, height = 1080, _firstPage = false } = options;
        assert(_.isFinite(width), "Page options.width must be number");
        assert(_.isFinite(height), "Page options.height must be number");
        assert(_.isBoolean(_firstPage), "Page options._firstPage must be boolean");
        this.width = width;
        this.height = height;
        this.#firstPage = _firstPage;
    }

    async init() {
        if(this.#firstPage)
            this.target = (await this.parent.target.pages())[0];
        else
            this.target = await this.parent.target.newPage();
         this.target.on("console", message => {
            if (message.type() === "error")  // 错误消息处理
                console.error("renderer error:", message.text(), message.stackTrace());
            else  // 其它消息处理
            console.log("renderer log:", message.text());
        });
        this.target.on("pageerror", err => console.error("renderer error:", err));
        this.target.once("error", err => {
            console.error(err);
            this.#setState(Page.STATE.UNAVAILABLED);  // 设置本页面为不可用
        });  // 目标崩溃处理
        this.target.once("close", () => this.close());  // 页面关闭处理
        await this.#renderEnvInit();
        this.#setState(Page.STATE.READY);
    }

    async setViewport(options = {}) {
        const { width, height } = options;
        assert(_.isFinite(width), "Page viewport width must be number");
        assert(_.isFinite(height), "Page viewport height must be number");
        this.width = width;
        this.height = height;
        await this.target.setViewport({
            ...options,
            width: Math.floor(width),
            height: Math.floor(height)
        });
    }

    async goto(url) {
        await this.target.goto(url);
    }

    async startScreencast() {
        this.#setState(Page.STATE.WORKING);
        const { width, height, ...options } = this.target.viewport() || {};
        if(width != this.width || height != this.height)
            await this.setViewport({ width, height, ...options });
        await this.#startCDPSession();
        this.#cdpSession.on("Page.screencastFrame", async frame => {
            const timestamp = frame.metadata.timestamp * 1000;
            this.#pushFrame(Buffer.from(frame.data, "base64"), timestamp);
           
            await this.target.evaluate(async () => {
                return new Promise(resolve => window.requestAnimationFrame(currentTime => {
                    // console.log(currentTime);
                    resolve();
                }));
            });
            this.#cdpSession && await this.#cdpSession.send("Page.screencastFrameAck", { sessionId: frame.sessionId });
        });
        await this.#cdpSession.send("Page.startScreencast", {
            maxWidth: this.width,
            maxHeight: this.height,
            format: "jpeg",
            everyNthFrame: 1
        });
        await this.target.evaluate(async () => window.renderCtx.start());
    }

    async stopScreencast() {
        await this.#cdpSession.send("Page.stopScreencast");
        // await this.#endCDPSession();
        this.#setState(Page.STATE.READY);
    }

    #pushFrame(data, timestamp) {
        let insertIndex = 0;
        for(let i = 0;i < this.#frameStack.length;i++) {
            const [_, _timestamp] = this.#frameStack[i];
            if(timestamp <= _timestamp) {
                insertIndex = i;
                break;
            }
        }
        if(insertIndex)
            this.#frameStack.splice(insertIndex, 0, [data, timestamp]);
        else
            this.#frameStack.push([data, timestamp]);
        if(this.#frameStack.length >= 10) {
            const [_data, _timestamp] = this.#frameStack.shift();
            if(this.#lastFrameTimestamp && this.#padCallback) {
                const duration = Math.floor(_timestamp - this.#lastFrameTimestamp);
                console.log(duration)
                if(duration > 0)
                    this.#padCallback(duration);
            }
            this.#frameCallback && this.#frameCallback(_data);
            this.#lastFrameTimestamp = _timestamp;
        }
    }

    onFrame(fn) {
        this.#frameCallback = fn;
    }

    onPad(fn) {
        this.#padCallback = fn;
    }

    async #renderEnvInit() {
        await this.target.evaluateOnNewDocument(config => {
            const ctx = {
                startupTime: Date.now(),  //启动时间点（毫秒）
                currentTime: 0,  //当前时间点（毫秒）
                config: config || {},  //配置对象
                interval: 0,
                rAFCallbacks: [],
                stopFlag: false,
                getTime: () => Date.NOW ? Date.NOW() : Date.now(),
                start: function () {
                    this.startTime = this.getTime();
                    this.interval = 1000 / this.config.fps;
                    const next = () => {
                        this.currentTime += this.interval;
                        window.rAF(next);
                    }
                    next();
                }
            }
            window.rAF = window.requestAnimationFrame;
            window.requestAnimationFrame = fn => window.rAF(() => fn(ctx.currentTime));
            Date.NOW = Date.now;
            Date.now = () => ctx.startupTime + ctx.currentTime;
            Date.prototype.getTime = Date.now;
            window.renderCtx = ctx;
        }, {
            fps: 60
        });
    }

    async #startCDPSession() {
        this.#cdpSession && await this.#endCDPSession();
        this.#cdpSession = await this.target.createCDPSession();  //创建会话
    }

    async #endCDPSession() {
        if (!this.#cdpSession) return;
        await new Promise(resolve => {
            this.#cdpSession.removeAllListeners();
            this.#cdpSession.detach()
                .catch(err => logger.error("process detach CDPSession error:", err))
                .finally(() => {
                    this.#cdpSession.removeAllListeners();
                    this.#cdpSession = null;
                    resolve();
                });
        });
    }

    async release() {
        await this.parent.releasePage(this);
        this.#setState(Page.STATE.READY);
    }

    async close() {
        if(this.isClosed())
            return;
        this.#setState(Page.STATE.CLOSED);
        await this.parent.closePage(this);
        if(!this.target || this.target.isClosed())
            return;
        this.target.close();
        this.target = null;
    }

    #setState(state) {
        assert(_.isSymbol(state), "state must be Symbol");
        this.state = state;
    }

    isUninitialized() {
        return this.state == Page.STATE.UNINITIALIZED;
    }

    isReady() {
        return this.state == Page.STATE.READY;
    }

    isWorking() {
        return this.state == Page.STATE.WORKING;
    }

    isUnavailabled() {
        return this.state == Page.STATE.UNAVAILABLED;
    }

    isClosed() {
        return this.state == Page.STATE.CLOSED;
    }

}