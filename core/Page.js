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
import MP4Demuxer from "../media/MP4Demuxer.js";
import VideoConfig from "../preprocessor/video/VideoConfig.js";
import Audio from "../entity/Audio.js";
import Font from "../entity/Font.js";
import globalConfig from "../lib/global-config.js";
import logger from "../lib/logger.js";
import innerUtil from "../lib/inner-util.js";
import util from "../lib/util.js";

/**
 * @typedef {import('puppeteer-core').Viewport} Viewport
 * @typedef {import('puppeteer-core').WaitForOptions} WaitForOptions
 */

// 默认用户UA
const DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0";
// 公共样式内容
const COMMON_STYLE_CONTENT = fs.readFileSync(util.rootPathJoin("lib/common.css"), "utf-8");
// MP4Box库脚本内容
const MP4BOX_LIBRARY_SCRIPT_CONTENT = fs.readFileSync(util.rootPathJoin("lib/mp4box.js"), "utf-8");
// Webfont库脚本内容
const FONTFACE_OBSERVER_SCRIPT_CONTENT = fs.readFileSync(util.rootPathJoin("lib/fontfaceobserver.js"), "utf-8");
// Lottie动画库脚本内容
const LOTTIE_LIBRARY_SCRIPT_CONTENT = fs.readFileSync(util.rootPathJoin("lib/lottie.js"), "utf-8");
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
        /** 已停止 */
        STOPPED: Symbol("STOPPED"),
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
    /** @type {string} - 帧图格式（jpeg/png） */
    frameFormat;
    /** @type {number} - 帧图质量（0-100） */
    frameQuality;
    /** @type {number} - 背景不透明度（0-1） */
    backgroundOpacity = 1;
    /** @type {Font[]} - 已注册字体集 */
    fonts = [];
    /** @type {Object[]} - 已接受资源列表 */
    acceptResources = [];
    /** @type {Object[]} - 已拒绝资源列表 */
    rejectResources = [];
    /** @type {Object[]} - CSS动画列表 */
    cssAnimations = [];
    /** @type {Set} - 资源排重Set */
    #resourceSet = new Set();
    /** @type {CDPSession} - CDP会话 */
    #cdpSession = null;
    /** @type {boolean} - 是否初始页面 */
    #firstPage = false;
    /** @type {AsyncLock} - */
    #asyncLock = new AsyncLock();

    /**
     * 构造函数
     * 
     * @param {Object} options - 页面选项
     * @property {number} [options.width] - 页面视窗宽度
     * @property {number} [options.height] - 页面视窗高度
     * @property {string} [options.userAgent] - 用户UA
     * @property {number} [options.beginFrameTimeout=5000] - BeginFrame超时时间（毫秒）
     * @property {string} [options.frameFormat="jpeg"] - 帧图格式（jpeg/png）
     * @property {number} [options.frameQuality=80] - 帧图质量（0-100）
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
        assert(_.isUndefined(frameQuality) || _.isFinite(frameQuality), "Page frameQuality must be number");
        assert(_.isUndefined(frameFormat) || _.isString(frameFormat), "Page frameFormat must be string");
        assert(_.isBoolean(_firstPage), "Page _firstPage must be boolean");
        this.width = width;
        this.height = height;
        this.userAgent = _.defaultTo(userAgent, _.defaultTo(globalConfig.userAgent, DEFAULT_USER_AGENT));
        this.beginFrameTimeout = _.defaultTo(beginFrameTimeout, _.defaultTo(globalConfig.beginFrameTimeout, 5000));
        this.frameFormat = _.defaultTo(frameFormat, _.defaultTo(globalConfig.frameFormat, "jpeg"));
        this.frameQuality = _.defaultTo(frameQuality, _.defaultTo(globalConfig.frameQuality, 80));
        this.#firstPage = _firstPage;
    }

    /**
     * 初始化页面
     */
    async init() {
        await this.#asyncLock.acquire("init", async () => {
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
     * @param {WaitForOptions} [waitForOptions] - 等待选项
     */
    async goto(url, waitForOptions) {
        assert(this.isReady(), "Page state must be ready");
        assert(util.isURL(url), "goto url is invalid");
        // 清除资源
        this.#resetStates();
        // 检查URL
        !globalConfig.allowUnsafeContext && this.#checkURL(url);
        // 开始CDP会话
        await this.#startCDPSession();
        // 监听CSS动画
        await this.#listenCSSAnimations();
        // 页面导航到URL
        await this.target.goto(url, waitForOptions);
        await Promise.all([
            // 注入公共样式
            this.#injectStyle(COMMON_STYLE_CONTENT),
            // 注入MP4Box库
            this.#injectLibrary(MP4BOX_LIBRARY_SCRIPT_CONTENT + ";window.____MP4Box = window.MP4Box;window.MP4Box = undefined"),
            // 注入Lottie动画库
            this.#injectLibrary(LOTTIE_LIBRARY_SCRIPT_CONTENT + ";window.____lottie = window.lottie;window.lottie = undefined")
        ]);
        // 初始化捕获上下文
        await this.target.evaluate(() => captureCtx.init());
    }

    /**
     * 设置页面内容
     * 
     * @param {string} content 页面内容
     * @param {WaitForOptions} [waitForOptions] - 等待选项
     */
    async setContent(content, waitForOptions) {
        assert(this.isReady(), "Page state must be ready");
        assert(_.isString(content), "page content must be string");
        await this.target.goto("about:blank");
        // 清除资源
        this.#resetStates();
        // 开始CDP会话
        await this.#startCDPSession();
        // 监听CSS动画
        await this.#listenCSSAnimations();
        await this.target.setContent(content, waitForOptions);
        await Promise.all([
            // 注入公共样式
            this.#injectStyle(COMMON_STYLE_CONTENT),
            // 注入MP4Box库
            this.#injectLibrary(MP4BOX_LIBRARY_SCRIPT_CONTENT + ";window.____MP4Box = window.MP4Box;window.MP4Box = undefined"),
            // 注入Lottie动画库
            this.#injectLibrary(LOTTIE_LIBRARY_SCRIPT_CONTENT + ";window.____lottie = window.lottie;window.lottie = undefined")
        ]);
        // 初始化捕获上下文
        await this.target.evaluate(() => captureCtx.init());
    }

    /**
     * 设置背景不透明度（0-1）
     * 
     * @param {number} [opacity=1] - 背景不透明度
     */
    setBackgroundOpacity(opacity = 1) {
        assert(this.isReady(), "Page state must be ready");
        assert(_.isFinite(opacity), "opacity must be number");
        this.backgroundOpacity = opacity;
    }

    /**
     * 注册字体
     * 
     * @param {Font} font - 字体对象
     */
    registerFont(font) {
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
    registerFonts(fonts = []) {
        fonts.forEach(font => this.registerFont(font));
    }

    /**
     * 等待字体加载完成
     * 
     * @param {number} [timeout=30000] - 等待超时时间（毫秒）
     */
    async waitForFontsLoaded(timeout = 30000) {
        // 注入Webfont库
        await this.#injectLibrary(FONTFACE_OBSERVER_SCRIPT_CONTENT + ";window.____FontFaceObserver = FontFaceObserver");
        // 等待字体加载完成
        await Promise.all(this.fonts.map(font => font.load()));
        // 将所有字体声明拼接为样式
        const styles = this.fonts.reduce((style, font) => style + font.toFontFace(), "");
        // 添加样式标签到页面
        styles && await this.#injectStyle(styles);
        await this.target.evaluate(async _timeout => {
            const fonts = [...document.fonts];
            // 无字体则跳过加载
            if (fonts.length == 0)
                return;
            // 等待字体加载完成
            let timer;
            await Promise.race([
                Promise.all(fonts.map(font => new ____FontFaceObserver(font.family).load())),
                new Promise((_, reject) => timer = setTimeout(reject, _timeout))
            ]);
            clearTimeout(timer);
        }, timeout);
    }

    /**
     * 注入样式
     * 
     * @param {string} content - 样式内容
     */
    async #injectStyle(content) {
        assert(_.isString(content), "inject style content must be string");
        await this.target.addStyleTag({
            content
        });
    }

    /**
     * 注入脚本库
     * 
     * @param {string} content - 脚本内容
     */
    async #injectLibrary(content) {
        assert(_.isString(content), "inject script content must be string");
        await this.target.addScriptTag({
            content
        });
    }

    /**
     * 开始录制
     * 
     * @param {Object} [options] - 录制选项
     * @param {number} [options.fps] - 渲染帧率
     * @param {number} [options.startTime=0] - 渲染开始事件点（毫秒）
     * @param {number} [options.duration] - 渲染时长（毫秒）
     * @param {number} [options.frameCount] - 渲染总帧数
     * @param {boolean} [options.autostart=true] - 是否自动启动渲染
     */
    async startScreencast(options = {}) {
        await this.#asyncLock.acquire("startScreencast", async () => {
            let { fps, startTime = 0, duration, frameCount, autostart = true } = options;
            assert(this.isReady(), "Page state must be ready");
            assert(_.isUndefined(fps) || _.isFinite(fps), "fps must be number");
            assert(_.isFinite(startTime), "startTime must be number");
            assert(_.isUndefined(duration) || _.isFinite(duration), "duration must be number");
            assert(_.isUndefined(frameCount) || _.isFinite(frameCount), "frameCount must be number");
            // 指定时长时将计算总帧数
            if (_.isFinite(duration))
                frameCount = util.durationToFrameCount(duration, fps);
            else if (_.isFinite(frameCount))
                duration = util.frameCountToDuration(frameCount, fps);
            // 页面进入捕获中状态
            this.#setState(Page.STATE.CAPTURING);
            // 当当前视图与设定不一致时进行调整
            const { width, height, ..._options } = this.target.viewport() || {};
            if (width != this.width || height != this.height)
                await this.setViewport({ width, height, ..._options });
            // 应用背景不透明度
            await this.#applyBackgroundOpacity();
            // 将鼠标移动到屏幕中央
            await this.target.mouse.move(width / 2, height / 2);
            // 如果设置帧率或者总帧数将覆盖页面中设置的帧率和总帧数
            await this.target.evaluate(async config => {
                // 注入配置选项
                Object.assign(captureCtx.config, config);
                // 如果准备后还未启动且自动启动选项开启时渲染则开始
                !captureCtx.ready() && captureCtx.config.autostart && captureCtx.start();
            }, _.pickBy({ fps, startTime, duration, frameCount, autostart }, v => !_.isUndefined(v)));
        });
    }

    /**
     * 暂停录制
     */
    async pauseScreencast() {
        assert(this.isCapturing(), "Page state is not capturing, unable to pause");
        await this.target.evaluate(async () => captureCtx.pauseFlag = true);
        this.#setState(Page.STATE.PAUSED);
    }

    /**
     * 恢复录制
     */
    async resumeScreencast() {
        assert(this.isPaused(), "Page state is not paused, unable to resume");
        await this.target.evaluate(async () => {
            if (captureCtx.resumeCallback) {
                captureCtx.resumeCallback();
                captureCtx.resumeCallback = null;
            }
            captureCtx.pauseFlag = false;
        });
        this.#setState(Page.STATE.CAPTURING);
    }

    /**
     * 停止录制
     */
    async stopScreencast() {
        await this.#asyncLock.acquire("stopScreencast", async () => {
            await this.target.evaluate(async () => captureCtx.stopFlag = true);
            await this.#endCDPSession();
            this.#setState(Page.STATE.STOPPED);
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
        return await this.target.evaluate(() => captureCtx.config);
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
            logger.error("Page error:", err);
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
            this.emit("crashed", err);
        else
            logger.error("Page crashed:", err);
    }

    /**
     * 发送录制完成事件
     */
    #emitScreencastCompleted() {
        this.emit("screencastCompleted");
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
                if (text.indexOf("Failed to load resource: the server responded with a status of ") != -1)
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
        await this.target.exposeFunction("____screencastCompleted", this.#emitScreencastCompleted.bind(this));
        // 暴露CSS动画控制函数
        await this.target.exposeFunction("____seekCSSAnimations", this.#seekCSSAnimations.bind(this));
        // 暴露下一帧函数
        await this.target.exposeFunction("____captureFrame", this.#captureFrame.bind(this));
        // 暴露添加音频函数
        await this.target.exposeFunction("____addAudio", this.#addAudio.bind(this));
        await this.target.exposeFunction("____updateAudioEndTime", this.#updateAudioEndTime.bind(this));
        // 暴露抛出错误函数
        await this.target.exposeFunction("____throwError", (code = -1, message = "") => this.#emitError(new Error(`throw error: [${code}] ${message}`)));
        // 页面加载前进行上下文初始化
        await this.target.evaluateOnNewDocument(`
            window.____util=(${innerUtil})();
            window.____MP4Demuxer=${MP4Demuxer};
            window.____SvgAnimation=${SvgAnimation};
            window.____VideoCanvas=${VideoCanvas};
            window.____DynamicImage=${DynamicImage};
            window.____LottieCanvas=${LottieCanvas};
            window.____CaptureContext=${CaptureContext};
            window.captureCtx=new ____CaptureContext();
        `);
    }

    /**
     * seek所有CSS动画
     */
    async #seekCSSAnimations(currentTime) {
        if (this.cssAnimations.length === 0)
            return;
        const pauseAnimationIds = [];
        const seekPromises = [];
        this.cssAnimations = this.cssAnimations.filter(animation => {
            if (animation.startTime == null)
                pauseAnimationIds.push(animation.id);
            animation.startTime = _.defaultTo(animation.startTime, currentTime);
            const animationCurrentTime = Math.floor(currentTime - animation.startTime);
            if (animationCurrentTime < 0)
                return true;
            seekPromises.push(this.#cdpSession.send("Animation.seekAnimations", {
                animations: [animation.id],
                currentTime: animationCurrentTime
            }));
            if (animationCurrentTime >= (animation.duration * (animation.iterations || Infinity)) + animation.delay)
                return false;
            return true;
        });
        // 暂停动画
        if (pauseAnimationIds.length > 0) {
            this.#cdpSession.send("Animation.setPaused", {
                animations: pauseAnimationIds,
                paused: true
            });
        }
        // 调度动画
        await Promise.all(seekPromises);
    }

    /**
     * 捕获帧
     */
    async #captureFrame() {
        try {
            // 非兼容渲染模式使用BeginFrame API进行捕获否则使用截图API
            const frameFormat = this.backgroundOpacity < 1 ? "png" : this.frameFormat;
            if (!globalConfig.compatibleRenderingMode) {
                let timer;
                // 帧数据捕获
                const frameData = await Promise.race([
                    this.#cdpSession.send("HeadlessExperimental.beginFrame", {
                        screenshot: {
                            // 帧图格式（jpeg, png)
                            format: frameFormat,
                            // 帧图质量（0-100）
                            quality: frameFormat == "jpeg" ? this.frameQuality : undefined
                        }
                    }),
                    // 帧渲染超时处理
                    new Promise(resolve => timer = setTimeout(() => resolve(false), this.beginFrameTimeout))
                ]);
                clearTimeout(timer);
                // 帧渲染超时处理
                if (frameData === false) {
                    this.#setState(Page.STATE.UNAVAILABLED);
                    throw new Error("beginFrame wait timeout");
                }
                if (!frameData || !frameData.screenshotData) return true;
                this.emit("frame", Buffer.from(frameData.screenshotData, "base64"));
            }
            else {
                const screenshotData = await this.target.screenshot({
                    type: frameFormat,
                    quality: frameFormat == "jpeg" ? this.frameQuality : undefined,
                    optimizeForSpeed: true
                });
                // 帧数据回调
                this.emit("frame", screenshotData);
            }
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
     * 更新音频结束时间点
     * 
     * @param {number} audioId - 内部音频ID
     * @param {number} endTime - 音频结束时间点
     */
    #updateAudioEndTime(audioId, endTime) {
        this.emit("audioUpdate", audioId, { endTime });
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
        audio && this.emit("audioAdd", audio);
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
     * 应用背景透明度
     */
    async #applyBackgroundOpacity() {
        await this.#cdpSession.send("Emulation.setDefaultBackgroundColorOverride", {
            color: { r: 0, g: 0, b: 0, a: this.backgroundOpacity }
        });
    }

    /**
     * 监听CSS动画
     */
    async #listenCSSAnimations() {
        // 启用动画通知域
        await this.#cdpSession.send("Animation.enable");
        // 监听动画开始事件将动画属性添加到调度列表
        this.#cdpSession.on("Animation.animationStarted", animation => {
            this.cssAnimations.push({
                id: animation.animation.id,
                startTime: null,
                paused: false,
                backendNodeId: animation.animation.source.backendNodeId,
                delay: animation.animation.source.delay,
                duration: animation.animation.source.duration,
                iterations: animation.animation.source.iterations
            });
        });
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
            // 如果是捕获中产生的跳转请求则终止
            if (this.isCapturing() && request.isNavigationRequest() && request.frame() === this.target.mainFrame()) {
                request.abort("aborted");
                return;
            }
            const method = request.method();
            const url = request.url();
            const { pathname } = new URL(url);
            // console.log(pathname);
            // 视频预处理API
            if (method == "POST" && pathname == "/api/video_preprocess") {
                const data = _.attempt(() => JSON.parse(request.postData()));
                if (_.isError(data))
                    throw new Error("api /api/video_preprocess only accept JSON data");
                const buffer = await this.#preprocessVideo(new VideoConfig(data));
                await request.respond({
                    status: 200,
                    body: buffer
                });
            }
            // 从本地拉取字体
            else if (method == "GET" && /^\/local_font\//.test(pathname)) {
                const filePath = path.join("tmp/local_font/", pathname.substring(12));
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
                logger.error(err);
                // 发生错误响应500
                request.respond({
                    status: 500,
                    body: err.stack
                })
                    .catch(err => logger.error(err));
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
                logger.error(message);
        }
    }

    /**
     * 重置页面
     */
    async reset() {
        await this.#asyncLock.acquire("reset", async () => {
            // 如果处于捕获状态则停止录制
            this.isCapturing() && await this.stopScreencast();
            // 如果CDP会话存在则结束会话
            this.#cdpSession && await this.#endCDPSession();
            // 移除监听器
            this.#removeListeners();
            // 清除资源
            this.#resetStates();
            this.#resourceSet = new Set();
            // 跳转空白页释放页面内存
            await this.target.goto("about:blank");
            // 设置页面状态为ready
            this.#setState(Page.STATE.READY);
        });
    }

    /**
     * 释放页面资源
     */
    async release() {
        await this.#asyncLock.acquire("release", async () => {
            // 重置页面
            await this.reset();
            // 设置页面状态为ready
            this.#setState(Page.STATE.READY);
        });
    }

    /**
     * 关闭页面
     */
    async close() {
        await this.#asyncLock.acquire("close", async () => {
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
     * 检查URL
     * 
     * @param {string} url - URL
     */
    #checkURL(url) {
        const { protocol, hostname, host } = new URL(url);
        if (protocol != "https:" && hostname != "127.0.0.1" && hostname != "localhost")
            throw new Error(`The URL ${protocol}//${host} is not a secure domain, which may cause security policies to disable some core features. Please use HTTPS protocol or http://localhost / http://127.0.0.1`);
    }

    /**
     * 重置状态
     */
    #resetStates() {
        this.backgroundOpacity = 1;
        this.fonts = [];
        this.acceptResources = [];
        this.rejectResources = [];
        this.cssAnimations = [];
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
        this.removeAllListeners("audioAdd");
        this.removeAllListeners("audioUpdate");
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
        if (message instanceof Error)
            message = message.stack;
        super(message);
        stack && (this.stack = stack);
    }
};