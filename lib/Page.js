import assert from "assert";
import AsyncLock from "async-lock";
import EventEmitter from "eventemitter3";
import { Page as _Page, CDPSession } from "puppeteer-core";
import _ from "lodash";

import Browser from "./Browser.js";

/**
 * @typedef {import('puppeteer-core').Viewport} Viewport
 */

// 默认用户UA
const DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36";
//异步锁
const asyncLock = new AsyncLock();
// 页面计数
let pageIndex = 1;

/**
 * 页面
 */
export default class Page extends EventEmitter {

    static STATE = {
        // 未初始化
        UNINITIALIZED: Symbol("UNINITIALIZED"),
        // 准备完毕
        READY: Symbol("READY"),
        // 捕获画面中
        CAPTURING: Symbol("CAPTURING"),
        // 不可用
        UNAVAILABLED: Symbol("UNAVAILABLED"),
        // 已关闭
        CLOSED: Symbol("CLOSED")
    };

    id = `Page@${pageIndex++}`;
    /** @type {Page.STATE} */
    state = Page.STATE.UNINITIALIZED;
    /** @type {Browser} */
    parent;
    /** @type {_Page} */
    target;
    /** @type {number} - 页面视窗宽度 */
    width;
    /** @type {number} - 页面视窗高度 */
    height;
    /** @type {string} - 用户UA */
    userAgent;
    /** @type {number} - BeginFrame超时时间（毫秒） */
    beginFrameTimeout;
    /** @type {string} - 帧图格式 */
    frameFormat;
    /** @type {number} - 帧图质量（0-100） */
    frameQuality;
    /** @type {CDPSession} */
    #cdpSession = null;
    #firstPage = false;

    /**
     * 构造函数
     * 
     * @param {Object} options - 页面选项
     * @property {number} [options.width] - 页面视窗宽度
     * @property {number} [options.height] - 页面视窗高度
     * @property {string} [options.userAgent] - 用户UA
     * @property {number} [options.beginFrameTimeout=5000] - BeginFrame超时时间（毫秒）
     * @property {string} [options.frameFormat="jpeg"] - 帧图格式
     * @property {number} [options.frameQuality=80] - 帧图质量（0-100）
     * @property {string[]} [options.args] - 浏览器启动参数
     */
    constructor(parent, options) {
        super();
        assert(parent instanceof Browser, "Page parent must be Browser");
        this.parent = parent;
        assert(_.isObject(options), "Page options must provided");
        const { width, height, userAgent, beginFrameTimeout,
            frameFormat, frameQuality, _firstPage = false } = options;
        assert(_.isUndefined(width) || _.isFinite(width), "Page width must be number");
        assert(_.isUndefined(height) || _.isFinite(height), "Page height must be number");
        assert(_.isUndefined(userAgent) || _.isString(userAgent), "Page userAgent must be string");
        assert(_.isUndefined(beginFrameTimeout) || _.isFinite(beginFrameTimeout), "Page beginFrameTimeout must be number");
        assert(_.isUndefined(frameFormat) || _.isString(frameFormat), "Page frameFormat must be string");
        assert(_.isUndefined(frameQuality) || _.isFinite(frameQuality), "Page frameQuality must be number");
        assert(_.isBoolean(_firstPage), "Page _firstPage must be boolean");
        this.width = width;
        this.height = height;
        this.userAgent = _.defaultTo(userAgent, DEFAULT_USER_AGENT);
        this.beginFrameTimeout = _.defaultTo(beginFrameTimeout, 5000);
        this.frameFormat = _.defaultTo(frameFormat, "jpeg");
        this.frameQuality = _.defaultTo(frameQuality, 80);
        this.#firstPage = _firstPage;
    }

    /**
     * 初始化页面
     */
    async init() {
        await asyncLock.acquire("init", async () => {
            // 如果是浏览器首个页面将复用已开启的第一个页面
            if (this.#firstPage)
                this.target = (await this.parent.target.pages())[0];
            else
                this.target = await this.parent.target.newPage();
            // 初始化渲染环境
            await this.#envInit();
            // 设置页面准备完毕
            this.#setState(Page.STATE.READY);
        });
    }

    /**
     * 设置视窗
     * 
     * @param {Viewport} options - 视窗选项
     */
    async setViewport(options = {}) {
        const { width, height } = options;
        assert(_.isFinite(width), "Page viewport width must be number");
        assert(_.isFinite(height), "Page viewport height must be number");
        this.width = width;
        this.height = height;
        // 设置页面视窗
        await this.target.setViewport({
            ...options,
            width: Math.floor(width),
            height: Math.floor(height)
        });
    }

    /**
     * 导航URL
     * 
     * @param {string} url - 导航目标URL
     */
    async goto(url) {
        // 页面导航到URL
        await this.target.goto(url);
        // 注入渲染辅助元素
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
                rotate = rotate >= 360 ? 0 : (rotate + 0.1);
                renderHelper.style.transform = `rotate(${rotate}deg)`;
                window.requestAnimationFrame(update);
            })();
        });
    }

    /**
     * 开始录制
     * 
     * @param {Object} options - 录制选项
     * @param {number} options.fps - 渲染帧率
     * @param {number} options.duration - 渲染时长
     * @param {number} options.frameCount - 渲染总帧数
     */
    async startScreencast(options = {}) {
        await asyncLock.acquire("startScreencast", async () => {
            let { fps, duration, frameCount } = options;
            assert(this.isReady(), "Page state must be ready");
            assert(_.isFinite(fps), "fps must be number");
            assert(_.isFinite(duration) || _.isFinite(frameCount), "duration or frameCount must be number");
            if (_.isFinite(duration))
                frameCount = Math.floor(duration / 1000 * fps);
            this.#setState(Page.STATE.CAPTURING);
            const { width, height, ..._options } = this.target.viewport() || {};
            if (width != this.width || height != this.height)
                await this.setViewport({ width, height, ..._options });
            await this.#startCDPSession();
            await this.#cdpSession.send('Animation.setPlaybackRate', {
                playbackRate: 1
            });
            await this.target.evaluate(async config => {
                Object.assign(window.captureCtx.config, config);
                window.captureCtx.start();
            }, { fps, frameCount });
        });
    }

    /**
     * 停止录制
     */
    async stopScreencast() {
        await asyncLock.acquire("stopScreencast", async () => {
            await this.target.evaluate(async () => window.captureCtx.stopFlag = true);
            await this.#endCDPSession();
            this.#setState(Page.STATE.READY);
        });
    }

    /**
     * 发送错误事件
     * 
     * @param {Error} err - 错误对象
     */
    #emitError(err) {
        if (this.eventNames().indexOf("error") != -1)
            this.emit("error", err);
        else
            console.error("page error:", err);
    }

    /**
     * 发送崩溃事件
     * 
     * @param {Error} err - 错误对象
     */
    #emitCrashed(err) {
        // 设置页面为不可用
        this.#setState(Page.STATE.UNAVAILABLED);
        if (this.eventNames().indexOf("crashed") != -1)
            this.emit("crashed", error);
        else
            console.error("page crashed:", err);
    }

    /**
     * 发送录制完成事件
     */
    #emitScreencastCompleted() {
        this.emit("screencastCompleted");
        this.#setState(Page.STATE.READY);
    }

    /**
     * 环境初始化
     */
    async #envInit() {
        // 设置UserAgent防止页面识别HeadlessChrome
        await this.target.setUserAgent(this.userAgent);
        // 页面控制台输出
        this.target.on("console", message => {
            // 错误消息处理
            if (message.type() === "error")
                this.emit("consoleError", new Error(message.text()));
            // 其它消息处理
            else
                this.emit("consoleLog", message.text());
        });
        // 页面错误回调
        this.target.on("pageerror", err => this.emit("consoleError", err));
        // 页面崩溃回调
        this.target.once("error", this.#emitCrashed.bind(this));
        // 页面关闭回调
        this.target.once("close", this.close.bind(this));
        // 暴露录制完成函数
        await this.target.exposeFunction("screencastCompleted", this.#emitScreencastCompleted.bind(this));
        // 暴露下一帧函数
        await this.target.exposeFunction("captureFrame", this.#captureFrame.bind(this));
        // 初始化捕获上下文
        await this.#contextInit();
    }

    /**
     * 捕获上下文初始化
     */
    async #contextInit() {
        await this.target.evaluateOnNewDocument(() => {
            const ctx = {
                // 启动时间点（毫秒）
                startupTime: Date.now(),
                // 当前时间点（毫秒）
                currentTime: 0,
                // 当前帧指针
                frameIndex: 0,
                // 帧间隔时间
                frameInterval: 0,
                // 停止标志
                stopFlag: false,
                // 配置
                config: {
                    // 渲染帧率
                    fps: 0,
                    // 目标帧率
                    frameCount: 0
                },
                // 获取现实时间
                getTime: () => Date.NOW ? Date.NOW() : Date.now(),
                // 启动捕获
                start: function () {
                    // 更新开始时间
                    this.startTime = this.getTime();
                    // 计算帧间隔时间
                    this.frameInterval = 1000 / this.config.fps;
                    // 递归捕获帧
                    (function nextFrame() {
                        (async () => {
                            // 捕获帧图
                            if(!await window.captureFrame()) {
                                this.stopFlag = true;
                                return;
                            }
                            // 捕获帧数到达目标帧数时终止捕获
                            if (this.frameIndex++ >= this.config.frameCount) {
                                this.stopFlag = true;
                                return window.screencastCompleted();
                            }
                            // 推进当前时间
                            this.currentTime += this.frameInterval;
                            nextFrame.bind(this)();
                        })()
                            .catch(err => console.error(`${err.message}\n${err.stack}`));
                    }).bind(this)();
                }
            }
            // 暂存requestAnimationFrame函数
            window.__requestAnimationFrame = window.requestAnimationFrame;
            // 重写requestAnimationFrame，传递上下文提供的currentTime确保在非60fps捕获时实现帧率同步
            window.requestAnimationFrame = fn => !ctx.stopFlag && window.__requestAnimationFrame(() => fn(ctx.currentTime));
            // 暂存Date.now函数
            Date.NOW = Date.now;
            // 重写Date.now函数，传递上下文提供的currentTime确保在以系统时间作为时基的动画库实现帧率同步
            Date.now = () => ctx.startupTime + ctx.currentTime;
            // 重写Date的getTime原型
            Date.prototype.getTime = Date.now;
            // 挂载上下文到全局
            window.captureCtx = ctx;
        });
    }

    /**
     * 捕获帧
     */
    async #captureFrame() {
        try {
            let timer;
            // 帧数据捕获
            const frameData = await Promise.race([
                this.#cdpSession.send("HeadlessExperimental.beginFrame", {
                    screenshot: {
                        // 帧图格式（jpg, png)
                        format: this.frameFormat,
                        // 帧图质量（0-100）
                        quality: this.frameQuality
                    }
                }),
                // 帧渲染超时
                new Promise(resolve => timer = setTimeout(() => resolve(false), this.beginFrameTimeout))
            ]);
            clearTimeout(timer);
            // 帧渲染超时处理
            if (frameData === false) {
                this.#setState(Page.STATE.UNAVAILABLED);
                throw new Error("beginFrame wait timeout");
            }
            if (!frameData.screenshotData) return true;
            // 帧数据回调
            this.emit("frame", Buffer.from(frameData.screenshotData, "base64"));
            return true;
        }
        catch (err) {
            this.#emitError(err);
            return false;
        }
    }

    /**
     * 开始CDP会话
     */
    async #startCDPSession() {
        this.#cdpSession && await this.#endCDPSession();
        this.#cdpSession = await this.target.createCDPSession();  //创建会话
    }

    /**
     * 结束CDP会话
     */
    async #endCDPSession() {
        if (!this.#cdpSession) return;
        await new Promise(resolve => {
            // 移除所有事件监听器
            this.#cdpSession.removeAllListeners();
            // 从页面卸载CDP会话
            this.#cdpSession.detach()
                .catch(err => this.emit("consoleError", err))
                .finally(() => {
                    this.#cdpSession = null;
                    resolve();
                });
        });
    }

    /**
     * 释放页面资源
     */
    async release() {
        await asyncLock.acquire("release", async () => {
            // 如果处于捕获状态则停止录制
            this.isCapturing() && await this.stopScreencast();
            // 如果CDP会话存在则结束会话
            this.#cdpSession && await this.#endCDPSession();
            // 移除监听器
            this.#removeListeners();
            // 跳转空白页释放页面内存
            await this.target.goto("about:blank");
            // 通知浏览器页面池释放页面资源
            await this.parent.releasePage(this);
            // 设置页面状态为ready
            this.#setState(Page.STATE.READY);
        });
    }

    /**
     * 关闭页面
     */
    async close() {
        await asyncLock.acquire("close", async () => {
            if (this.isClosed())
                return;
            // 设置页面状态为closed
            this.#setState(Page.STATE.CLOSED);
            // 通知浏览器页面池销毁页面资源
            await this.parent.destoryPage(this);
            // 如果页面已关闭则跳过
            if (!this.target || this.target.isClosed())
                return;
            this.target.close();
            this.target = null;
        });
    }

    /**
     * 移除监听器
     */
    #removeListeners() {
        this.removeAllListeners("frame");
        this.removeAllListeners("screencastCompleted");
        this.removeAllListeners("consoleLog");
        this.removeAllListeners("consoleError");
        this.removeAllListeners("error");
        this.removeAllListeners("crashed");
    }

    /**
     * 设置页面资源状态
     * 
     * @param {Page.STATE} state 
     */
    #setState(state) {
        assert(_.isSymbol(state), "state must be Symbol");
        this.state = state;
    }

    /**
     * 是否未初始化
     * 
     * @returns {boolean} - 是否未初始化
     */
    isUninitialized() {
        return this.state == Page.STATE.UNINITIALIZED;
    }

    /**
     * 是否准备完毕
     * 
     * @returns {boolean} - 是否准备完毕
     */
    isReady() {
        return this.state == Page.STATE.READY;
    }

    /**
     * 是否正在捕获
     * 
     * @returns {boolean} - 是否正在捕获
     */
    isCapturing() {
        return this.state == Page.STATE.CAPTURING;
    }

    /**
     * 是否不可用
     * 
     * @returns {boolean} - 是否不可用
     */
    isUnavailabled() {
        return this.state == Page.STATE.UNAVAILABLED;
    }

    /**
     * 是否已关闭
     * 
     * @returns {boolean} - 是否已关闭
     */
    isClosed() {
        return this.state == Page.STATE.CLOSED;
    }

}