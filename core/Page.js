import assert from "assert";
import path from "path";
import AsyncLock from "async-lock";
import EventEmitter from "eventemitter3";
import { Page as _Page, CDPSession, HTTPRequest, HTTPResponse } from "puppeteer-core";
import fs from "fs-extra";
import _ from "lodash";

import Browser from "./Browser.js";
import CaptureContext from "./CaptureContext.js";
import SvgAnimation from "../media/SvgAnimation.js";
import VideoCanvas from "../media/VideoCanvas.js";
import DynamicImage from "../media/DynamicImage.js";
import LottieCanvas from "../media/LottieCanvas.js";
import VideoConfig from "../preprocessor/video/VideoConfig.js";
import Audio from "../entity/Audio.js";
import Font from "../entity/Font.js";
import util from "../lib/util.js";
/**
 * @typedef {import('puppeteer-core').Viewport} Viewport
 */

// 默认用户UA
const DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0";
// MP4Box库脚本内容
const MP4BOX_LIBRARY_SCRIPT_CONTENT = fs.readFileSync(util.rootPathJoin("lib/mp4box.js"), "utf-8");
// Webfont库脚本内容
const FONTFACE_OBSERVER_SCRIPT_CONTENT = fs.readFileSync(util.rootPathJoin("lib/fontfaceobserver.js"), "utf-8");
// Lottie动画库脚本内容
const LOTTIE_LIBRARY_SCRIPT_CONTENT = fs.readFileSync(util.rootPathJoin("lib/lottie.js"), "utf-8");
// 异步锁
const asyncLock = new AsyncLock();
// 页面计数
let pageIndex = 1;

/**
 * 页面
 */
export default class Page extends EventEmitter {

    /** 页面状态枚举 */
    static STATE = {
        /** 未初始化 */
        UNINITIALIZED: Symbol("UNINITIALIZED"),
        /** 已就绪 */
        READY: Symbol("READY"),
        /** 录制中 */
        CAPTURING: Symbol("CAPTURING"),
        /** 已暂停 */
        PAUSED: Symbol("PAUSED"),
        /** 不可用 */
        UNAVAILABLED: Symbol("UNAVAILABLED"),
        /** 已关闭 */
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
    /** @type {Font[]} - 已注册字体集 */
    fonts = [];
    /** @type {Object[]} - 已接受资源列表 */
    acceptResources = [];
    /** @type {Object[]} - 已拒绝资源列表 */
    rejectResources = [];
    /** @type {Set} - 资源排重Set */
    #resourceSet = new Set();
    /** @type {CDPSession} - CDP会话 */
    #cdpSession = null;
    /** @type {boolean} - 是否初始页面 */
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
            // 设置页面已就绪
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
     * @returns {Object} - 控制器映射
     */
    async goto(url) {
        // 清除资源
        this.#clearResources();
        // 页面导航到URL
        await this.target.goto(url);
        await Promise.all([
            // 注入MP4Box库
            this.#injectLibrary(MP4BOX_LIBRARY_SCRIPT_CONTENT),
            // 注入Lottie动画库
            this.#injectLibrary(LOTTIE_LIBRARY_SCRIPT_CONTENT)
        ]);
    }

    /**
     * 注册字体
     * 
     * @param {Font} font - 字体对象
     */
    async registerFont(font) {
        if (!(font instanceof Font))
            font = new Font(font);
        // 开始加载字体
        font.load();
        this.fonts.push(font);
    }

    /**
     * 注册多个字体
     * 
     * @param {Font[]} fonts - 字体对象列表
     */
    async registerFonts(fonts = []) {
        fonts.forEach(font => this.registerFont(font));
    }

    /**
     * 等待字体加载完成
     * 
     * @param {number} [timeout=30000] - 等待超时时间（毫秒）
     */
    async waitForFontsLoaded(timeout = 30000) {
        // 注入Webfont库
        await this.#injectLibrary(FONTFACE_OBSERVER_SCRIPT_CONTENT);
        // 等待字体加载完成
        await Promise.all(this.fonts.map(font => font.load()));
        // 将所有字体声明拼接为样式
        const styles = this.fonts.reduce((style, font) => style + font.toFontFace(), "");
        // 添加样式标签到页面
        styles && await this.target.addStyleTag({
            content: styles
        });
        await this.target.evaluate(async _timeout => {
            // 获取样式表
            const styleSheets = Array.from(document.styleSheets);
            // 获取所有引入的字体集
            const fontFamilys = [];
            styleSheets.forEach((styleSheet) => {
                const rules = styleSheet.cssRules || styleSheet.rules;
                if (!rules)
                    return;
                Array.from(rules).map(rule => {
                    if (rule.constructor.name === "CSSFontFaceRule") {
                        const fontFamily = rule.style.getPropertyValue('font-family');
                        fontFamilys.push(fontFamily);
                    }
                });
            });
            // 无字体则跳过加载
            if (fontFamilys.length == 0)
                return;
            // 等待字体加载完成
            let timer;
            await Promise.race([
                Promise.all(fontFamilys.map(family => new FontFaceObserver(family).load())),
                new Promise((_, reject) => timer = window.____setTimeout(reject, _timeout))
            ]);
            window.____clearTimeout(timer);
        }, timeout);
    }

    /**
     * 注入脚本库
     */
    async #injectLibrary(content) {
        await this.target.addScriptTag({
            content
        });
    }

    /**
     * 开始录制
     * 
     * @param {Object} [options] - 录制选项
     * @param {number} [options.fps] - 渲染帧率
     * @param {number} [options.duration] - 渲染时长（毫秒）
     * @param {number} [options.frameCount] - 渲染总帧数
     */
    async startScreencast(options = {}) {
        await asyncLock.acquire("startScreencast", async () => {
            let { fps, duration, frameCount } = options;
            assert(this.isReady(), "Page state must be ready");
            assert(_.isUndefined(fps) || _.isFinite(fps), "fps must be number");
            assert(_.isUndefined(duration) || _.isFinite(duration), "duration must be number");
            assert(_.isUndefined(frameCount) || _.isFinite(frameCount), "frameCount must be number");
            // 指定时长时将计算总帧数
            if (_.isFinite(duration))
                frameCount = util.durationToFrameCount(duration, fps);
            // 页面进入捕获中状态
            this.#setState(Page.STATE.CAPTURING);
            // 当当前视图与设定不一致时进行调整
            const { width, height, ..._options } = this.target.viewport() || {};
            if (width != this.width || height != this.height)
                await this.setViewport({ width, height, ..._options });
            // 开始CDP会话
            await this.#startCDPSession();
            // 设置CSS动画播放速度
            await this.#cdpSession.send("Animation.setPlaybackRate", {
                // 根据帧率设置播放速率
                playbackRate: Math.floor(60 / fps)
            });
            // 如果设置帧率或者总帧数将覆盖页面中设置的帧率和总帧数
            await this.target.evaluate(async config => {
                Object.assign(window.captureCtx.config, config);
                window.captureCtx.start();
            }, { fps, frameCount });
        });
    }

    /**
     * 暂停录制
     */
    async pauseScreencast() {
        assert(this.isCapturing(), "Page state is not capturing, unable to pause");
        await this.target.evaluate(async () => window.captureCtx.pauseFlag = true);
        this.#setState(Page.STATE.PAUSED);
    }

    /**
     * 恢复录制
     */
    async resumeScreencast() {
        assert(this.isPaused(), "Page state is not paused, unable to resume");
        await this.target.evaluate(async () => {
            if (window.captureCtx.resumeCallback) {
                window.captureCtx.resumeCallback();
                window.captureCtx.resumeCallback = null;
            }
            window.captureCtx.pauseFlag = false;
        });
        this.#setState(Page.STATE.CAPTURING);
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
     * @typedef {Object} CaptureContextConfig
     * @property {number} fps - 捕获帧率
     * @property {number} frameCount - 捕获总帧数
     */
    /**
     * 获取捕获上下文配置
     * 
     * @returns {CaptureContextConfig} - 配置对象
     */
    async getCaptureContextConfig() {
        return await this.target.evaluate(() => window.captureCtx.config);
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
        // 禁用CSP策略
        await this.target.setBypassCSP(true);
        // 拦截请求
        await this.target.setRequestInterception(true);
        // 页面控制台输出
        this.target.on("console", message => {
            const type = message.type();
            const text = message.text();
            // 错误消息处理
            if (type === "error") {
                if (text.indexOf("Failed to load resource: the server responded with a status of " != -1))
                    return;
                this.emit("consoleError", new PageError(text));
            }
            // 其它消息处理
            else
                this.emit("consoleLog", text);
        });
        // 页面加载完成事件
        this.target.on("domcontentloaded", async () => {
            // 如果处于录制状态作为被动刷新处理
            if (this.isCapturing())
                this.#emitError(new Error("Page context is missing, possibly due to the page being refreshed"))
        });
        // 页面请求处理
        this.target.on("request", this.#requestHandle.bind(this));
        // 页面响应处理
        this.target.on("response", this.#responseHandle.bind(this));
        // 页面错误回调
        this.target.on("pageerror", err => this.emit("consoleError", new PageError(err)));
        // 页面崩溃回调
        this.target.once("error", this.#emitCrashed.bind(this));
        // 页面关闭回调
        this.target.once("close", this.close.bind(this));
        // 暴露录制完成函数
        await this.target.exposeFunction("screencastCompleted", this.#emitScreencastCompleted.bind(this));
        // 暴露下一帧函数
        await this.target.exposeFunction("captureFrame", this.#captureFrame.bind(this));
        // 暴露添加音频函数
        await this.target.exposeFunction("addAudio", this.#addAudio.bind(this));
        // 暴露抛出错误函数
        await this.target.exposeFunction("throwError", (code = -1, message = "") => this.#emitError(new Error(`throw error: [${code}] ${message}`)));
        // 页面加载前进行上下文初始化
        await this.target.evaluateOnNewDocument(`
            window.CaptureContext=${CaptureContext};
            window.captureCtx=new CaptureContext();
            window.SvgAnimation=${SvgAnimation};
            window.VideoCanvas=${VideoCanvas};
            window.DynamicImage=${DynamicImage};
            window.LottieCanvas=${LottieCanvas};
        `);
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
     * 添加音频
     * 
     * @param {Audio} options 
     */
    #addAudio(options) {
        this.emit("audioAdd", new Audio(options));
    }

    /**
     * 预处理视频
     * 
     * @param {VideoConfig} config - 视频配置
     */
    async #preprocessVideo(config) {
        const videoPreprocessor = this.videoPreprocessor;
        this.emit("videoPreprocess", config);
        const { audio, buffer } = await videoPreprocessor.process(config);
        this.emit("audioAdd", audio);
        return buffer;
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
     * 页面请求处理
     * 
     * @param {HTTPRequest} request - 页面请求
     */
    #requestHandle(request) {
        (async () => {
            const method = request.method();
            const url = request.url();
            const { pathname } = new URL(url);
            // console.log(pathname);
            // 视频预处理API
            if (method == "POST" && pathname == "/video_preprocess") {
                const data = _.attempt(() => JSON.parse(request.postData()));
                if (_.isError(data))
                    throw new Error("api /video_preprocess only accept JSON data");
                const buffer = await this.#preprocessVideo(new VideoConfig(data));
                await request.respond({
                    status: 200,
                    body: buffer
                });
            }
            // 从本地拉取字体
            else if (method == "GET" && /^\/local_font\//.test(pathname)) {
                const filePath = path.join(util.rootPathJoin("tmp/local_font/"), pathname.substring(12));
                if (!await fs.pathExists(filePath)) {
                    return await request.respond({
                        status: 404,
                        body: "File not exists"
                    });
                }
                else {
                    await request.respond({
                        status: 200,
                        body: await fs.readFile(filePath),
                        headers: {
                            // 要求浏览器缓存字体
                            "Cache-Control": "max-age=31536000"
                        }
                    });
                }
            }
            // 其它请求透传
            else
                await request.continue();
        })()
            .catch(err => {
                // 发生错误响应500
                request.respond({
                    status: 500,
                    body: err.stack
                })
                    .catch(err => console.error(err));
            })
    }

    /**
     * 页面响应处理
     * 
     * @param {HTTPResponse} response - HTTP响应
     */
    #responseHandle(response) {
        const status = response.status();
        const statusText = response.statusText();
        const method = response.request().method();
        const url = response.url();
        const id = `${method}:${url}`;
        if (this.#resourceSet.has(id))
            return;
        this.#resourceSet.add(id);
        const info = {
            status,
            statusText,
            method,
            url
        };
        if (status < 400) {
            this.acceptResources.push(info);
            this.emit("resourceAccepted", info);
        }
        else {
            this.rejectResources.push(info);
            const message = `Fetch response failed: [${method}] ${url} - [${status}] ${statusText}`;
            if (this.eventNames().indexOf("resourceError") != -1)
                this.emit("resourceRejected", new Error(message));
            else
                console.error(message);
        }
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
            // 清除资源
            this.#clearResources();
            this.#resourceSet = new Set();
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
     * 清除资源
     */
    #clearResources() {
        this.fonts = [];
        this.acceptResources = [];
        this.rejectResources = [];
    }

    /**
     * 移除所有监听器
     */
    #removeListeners() {
        this.removeAllListeners("frame");
        this.removeAllListeners("screencastCompleted");
        this.removeAllListeners("consoleLog");
        this.removeAllListeners("consoleError");
        this.removeAllListeners("resourceAccepted");
        this.removeAllListeners("resourceRejected");
        this.removeAllListeners("videoPreprocess");
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
     * 是否已就绪
     * 
     * @returns {boolean} - 是否已就绪
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
     * 是否已暂停
     * 
     * @returns {boolean} - 是否已暂停
     */
    isPaused() {
        return this.state == Page.STATE.PAUSED;
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

    /**
     * 获取视频预处理器
     */
    get videoPreprocessor() {
        return this.parent.videoPreprocessor;
    }

}

class PageError extends Error {
    name = "PageError";
    constructor(message) {
        let stack;
        if (message instanceof Error) {
            message = message.message;
            stack = message.stack;
        }
        super(message);
        stack && (this.stack = stack);
    }
};