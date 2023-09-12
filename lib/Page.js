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
    #frameIndex = 0;
    #frameInterval = 0;
    #frameCallback = null;
    #logCallback = null;
    #errorCallback = null;
    #padCallback = null;
    #crashCallback = null;
    #completeCallback = null;
    #frameStack = [];
    #overDuration = 0;
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
        if (this.#firstPage)
            this.target = (await this.parent.target.pages())[0];
        else
            this.target = await this.parent.target.newPage();
        this.target.on("console", message => {
            if (message.type() === "error") {
                if (this.#errorCallback) {
                    const error = new Error(message.text());
                    error.stack = message.stackTrace();
                    this.#errorCallback(error);
                }
                else
                    console.error("page error:", message.text(), message.stackTrace());
            }
            else if (this.#logCallback)
                this.#logCallback(message.text());
        });
        this.target.on("pageerror", err => this.#errorCallback && this.#errorCallback(err));
        this.target.once("error", err => {
            if (this.#crashCallback)
                this.#crashCallback(err);
            else
                console.error("page crashed:", err);
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
        await this.target.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36");
        await this.target.goto(url);
        await this.target.evaluate(() => {
            const renderHelper = document.createElement("headless-render-helper");
            Object.assign(renderHelper.style, {
                width: "20px",
                height: "20px",
                opacity: 1,
                position: "fixed",
                top: 40,
                left: 40,
                zIndex: 999,
                backgroundColor: "red",
                transform: "rotate(0deg)"
            });  //设置几乎看不见的样式
            document.body.appendChild(renderHelper);  //加入到body中
            let rotate = 0;
            (function update() {
                rotate = rotate >= 360 ? 0 : (rotate + 0.5);
                renderHelper.style.transform = `rotate(${rotate}deg)`;
                window.requestAnimationFrame(update);
            })();
        });
    }

    async startScreencast(options = {}) {
        const { fps, duration } = options;
        assert(_.isFinite(fps), "fps must be number");
        assert(_.isFinite(duration), "duration must be number");
        this.#setState(Page.STATE.WORKING);
        const { width, height, ..._options } = this.target.viewport() || {};
        if (width != this.width || height != this.height)
            await this.setViewport({ width, height, ..._options });
        this.#frameInterval = 1000 / fps;
        const frameCount = Math.floor((duration / 1000) * fps);
        console.log("frameCount:", frameCount)
        await this.#startCDPSession();
        // this.#cdpSession.on("Page.screencastFrame", async frame => {
        //     const timestamp = frame.metadata.timestamp * 1000;
        //     this.#pushFrame(Buffer.from(frame.data, "base64"), timestamp);
        //     await new Promise((resolve, reject) => {
        //         if (!this.#cdpSession) return resolve();
        //         this.#cdpSession.send("Page.screencastFrameAck", { sessionId: frame.sessionId })
        //             .then(resolve)
        //             .catch(err => {
        //                 if (err.message.indexOf("Target closed") != -1)
        //                     return resolve();
        //                 reject(err);
        //             })
        //     });
        //     await this.#cdpSession.send("HeadlessExperimental.beginFrame");  //beginFrame
        //     this.#frameIndex++;
        //     console.log("REAL", this.#frameIndex);
        //     if (this.#frameIndex >= frameCount) {
        //         this.#drainFrames();
        //         this.#completeCallback && this.#completeCallback();
        //     }
        // });
        await this.#cdpSession.send('Animation.setPlaybackRate', {
            playbackRate: 1
        });
        // await this.#cdpSession.send("Page.startScreencast", {
        //     maxWidth: this.width,
        //     maxHeight: this.height,
        //     everyNthFrame: 1,
        //     format: "jpeg"
        // });
        await this.target.evaluate(async config => {
            Object.assign(window.renderCtx.config, config);
            window.renderCtx.start();
        }, { fps, duration });
        // await this.#cdpSession.send("HeadlessExperimental.beginFrame");  //beginFrame
    }

    async stopScreencast() {
        // await this.#cdpSession.send("Page.stopScreencast");
        await this.target.evaluate(async () => window.renderCtx.stopFlag = true);
        await this.#endCDPSession();
        this.#setState(Page.STATE.READY);
    }

    onLog(fn) {
        this.#logCallback = fn;
    }

    onError(fn) {
        this.#errorCallback = fn;
    }

    onCrashed(fn) {
        this.#crashCallback = fn;
    }

    onFrame(fn) {
        this.#frameCallback = fn;
    }

    onPad(fn) {
        this.#padCallback = fn;
    }

    onComplete(fn) {
        this.#completeCallback = fn;
    }

    async #renderEnvInit() {
        await this.target.exposeFunction("renderComplete", async () => this.#completeCallback && this.#completeCallback());
        await this.target.exposeFunction("nextFrame", async () => {
            try {
                let timer;
                const frameData = await Promise.race([
                    this.#cdpSession.send("HeadlessExperimental.beginFrame", { screenshot: { format: "jpeg", quality: 80 } }),  //beginFrame
                    new Promise(resolve => timer = setTimeout(() => resolve(false), 5000))  //超时处理
                ]);  //截帧处理，如超过超时时间将跳过处理并返回false
                clearTimeout(timer);
                if (frameData === false) {
                    this.#setState(Page.STATE.UNAVAILABLED);
                    throw new Error("beginFrame wait timeout");
                }
                if (!frameData.screenshotData) return true;
                this.#frameCallback && this.#frameCallback(Buffer.from(frameData.screenshotData, "base64"));
                return true;
            }
            catch (err) {
                console.error(err);
                // this.#errorCallback(err);
                return false;
            }
        });
        await this.target.evaluateOnNewDocument(() => {
            const ctx = {
                startupTime: Date.now(),  //启动时间点（毫秒）
                currentTime: 0,  //当前时间点（毫秒）
                config: {
                    fps: 0,
                    duration: 0
                },  //配置对象
                interval: 0,
                stopFlag: false,
                getTime: () => Date.NOW ? Date.NOW() : Date.now(),
                start: function () {
                    this.startTime = this.getTime();
                    this.interval = 1000 / this.config.fps;
                    (function renderFrame() {
                        (async () => {
                            if(!await window.nextFrame()) return;
                            if(this.currentTime >= this.config.duration) {
                                this.stopFlag = true;
                                return window.renderComplete();
                            }
                            this.currentTime += this.interval;
                            renderFrame.bind(this)();
                        })()
                        .catch(err => console.error(err));
                    }).bind(this)()
                }
            }
            window.rAF = window.requestAnimationFrame;
            window.requestAnimationFrame = fn => !ctx.stopFlag && window.rAF(() => fn(ctx.currentTime));
            Date.NOW = Date.now;
            Date.now = () => ctx.startupTime + ctx.currentTime;
            Date.prototype.getTime = Date.now;
            window.renderCtx = ctx;
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
        this.#logCallback = null;
        this.#errorCallback = null;
        this.#crashCallback = null;
        this.#frameCallback = null;
        this.#padCallback = null;
        await this.target.goto("about:blank");
        await this.parent.releasePage(this);
        this.#setState(Page.STATE.READY);
    }

    async close() {
        if (this.isClosed())
            return;
        this.#setState(Page.STATE.CLOSED);
        await this.parent.closePage(this);
        if (!this.target || this.target.isClosed())
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