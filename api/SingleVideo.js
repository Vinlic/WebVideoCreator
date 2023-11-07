import assert from "assert";
import _ from "lodash";
import AsyncLock from "async-lock";

import Synthesizer from "../core/Synthesizer.js";
import Page from "../core/Page.js";
import Font from "../entity/Font.js";
import logger from "../lib/logger.js";
import util from "../lib/util.js";

/**
 * 单幕视频
 */
export default class SingleVideo extends Synthesizer {

    /** @type {string} - 页面URL */
    url;
    /** @type {string} - 页面内容 */
    content;
    /** @type {number} - 视频时长 */
    duration;
    /** @type {Font[]} - 注册的字体列表 */
    fonts = [];
    /** @type {boolean} - 是否自动启动渲染 */
    autostartRender;
    /** @type {boolean} - 是否输出页面控制台日志 */
    consoleLog;
    /** @type {boolean} - 是否输出视频预处理日志 */
    videoPreprocessLog;
    /** @type {Function} - 页面预处理函数 */
    pagePrepareFn;
    /** @type {Function} - 页面获取函数 */
    #pageAcquireFn = null;
    /** @type {AsyncLock} - 异步锁 */
    #asyncLock = new AsyncLock();

    /**
     * 构造函数
     * 
     * @param {Object} options - 单幕视频选项
     * @param {string} [options.url] - 页面URL
     * @param {string} [options.content] - 页面内容
     * @param {string} options.outputPath - 输出路径
     * @param {number} options.width - 视频宽度
     * @param {number} options.height - 视频高度
     * @param {number} options.duration - 视频时长
     * @param {number} [options.fps=30] - 视频帧率
     * @param {string} [options.format] - 导出视频格式（mp4/webm）
     * @param {string} [options.attachCoverPath] - 附加到视频首帧的封面路径
     * @param {string} [options.coverCapture=false] - 是否捕获封面并输出
     * @param {number} [options.coverCaptureTime] - 封面捕获时间点（毫秒）
     * @param {string} [options.coverCaptureFormat="jpg"] - 封面捕获格式（jpg/png/bmp）
     * @param {string} [options.videoEncoder="libx264"] - 视频编码器
     * @param {number} [options.videoQuality=100] - 视频质量（0-100）
     * @param {string} [options.videoBitrate] - 视频码率（设置码率将忽略videoQuality）
     * @param {string} [options.pixelFormat="yuv420p"] - 像素格式（yuv420p/yuv444p/rgb24）
     * @param {string} [options.audioEncoder="aac"] - 音频编码器
     * @param {string} [options.audioBitrate] - 音频码率
     * @param {number} [options.volume] - 视频音量（0-100）
     * @param {number} [options.parallelWriteFrames=10] - 并行写入帧数
     * @param {Function} [options.pagePrepareFn] - 页面预处理函数
     * @param {boolean} [options.showProgress=false] - 是否在命令行展示进度
     * @param {boolean} [options.autostartRender=true] - 是否自动启动渲染，如果为false请务必在页面中执行 captureCtx.start()
     * @param {boolean} [options.consoleLog=false] - 是否开启控制台日志输出
     * @param {boolean} [options.videoPreprocessLog=false] - 是否开启视频预处理日志输出
     */
    constructor(options = {}) {
        super(options);
        const { url, content, duration, autostartRender, consoleLog, videoPreprocessLog, pagePrepareFn } = options;
        assert(_.isUndefined(url) || util.isURL(url), `url ${url} is not valid URL`);
        assert(_.isUndefined(content) || _.isString(content), "page content must be string");
        assert(!_.isUndefined(url) || !_.isUndefined(content), "page url or content must be provide");
        assert(_.isFinite(duration), "duration must be number");
        assert(_.isUndefined(autostartRender) || _.isBoolean(autostartRender), "autostartRender must be boolean");
        assert(_.isUndefined(consoleLog) || _.isBoolean(consoleLog), "consoleLog must be boolean");
        assert(_.isUndefined(pagePrepareFn) || _.isFunction(pagePrepareFn), "pagePrepareFn must be Function");
        this.url = url;
        this.content = content;
        this.duration = duration;
        this.autostartRender = _.defaultTo(autostartRender, true);
        this.consoleLog = _.defaultTo(consoleLog, false);
        this.videoPreprocessLog = _.defaultTo(videoPreprocessLog, false);
        this.pagePrepareFn = pagePrepareFn;
    }

    /**
     * 启动合成
     */
    start() {
        this.#asyncLock.acquire("start", () => this.#synthesize())
            .catch(err => logger.error(err));
    }

    /**
     * 启动并等待完成
     */
    async startAndWait() {
        await this.#asyncLock.acquire("start", () => this.#synthesize());
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
     * 合成处理
     */
    async #synthesize() {
        const page = await this.#acquirePage();
        try {
            const { url, content, width, height, fps, duration } = this;
            // 监听页面实例发生的某些内部错误
            page.on("error", err => this._emitError("Page error:\n" + err.stack));
            // 监听页面是否崩溃，当内存不足或过载时可能会崩溃
            page.on("crashed", err => this._emitError("Page crashed:\n" + err.stack));
            if (this.consoleLog) {
                // 监听页面打印到console的正常日志
                page.on("consoleLog", message => logger.log("[page]", message));
                // 监听页面打印到console的错误日志
                page.on("consoleError", err => logger.error("[page]", err));
            }
            if (this.videoPreprocessLog)
                page.on("videoPreprocess", config => logger.log("[video_preprocess]", config.url));
            page.on("audioAdd", options => this.addAudio(options));
            page.on("audioUpdate", (audioId, options) => this.updateAudio(audioId, options))
            // 设置视窗宽高
            await page.setViewport({
                width,
                height
            });
            // 跳转到您希望渲染的页面，您可以考虑创建一个本地的Web服务器提供页面以提升加载速度和安全性
            if(url)
                await page.goto(url);
            // 或者设置页面内容
            else
                await page.setContent(content);
            // 存在预处理函数时先执行预处理
            this.pagePrepareFn && await this.pagePrepareFn(page);
            // 注册字体
            if(this.fonts.length > 0)
                page.registerFonts(this.fonts);
            // 等待字体加载完成
            await page.waitForFontsLoaded();
            // 启动合成
            super.start();
            // 合成完成promise
            const completedPromise = new Promise(resolve => this.once("completed", resolve));
            // 监听已渲染的帧输入到合成器
            page.on("frame", buffer => this.input(buffer));
            // 启动捕获
            await page.startScreencast({
                fps,
                duration,
                autostart: this.autostartRender
            });
            // 监听并等待录制完成
            await new Promise(resolve => page.once("screencastCompleted", resolve));
            // 停止录制
            await page.stopScreencast();
            // 释放页面资源
            await page.release();
            // 告知合成器结束输入
            this.endInput();
            // 等待合成完成
            await completedPromise;
        }
        catch (err) {
            await page.release();
            this._emitError(err);
        }
    }

    /**
     * 注册页面获取函数
     * 
     * @param {Function} fn 
     */
    onPageAcquire(fn) {
        assert(_.isFunction(fn), "Page acquire function must be Function");
        this.#pageAcquireFn = fn;
    }

    /**
     * 获取渲染页面
     * 
     * @protected
     * @returns {Page} - 页面对象
     */
    async #acquirePage() {
        assert(_.isFunction(this.#pageAcquireFn), "Page acquire function must be Function");
        return await this.#pageAcquireFn();
    }

}