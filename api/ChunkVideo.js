import assert from "assert";
import _ from "lodash";
import AsyncLock from "async-lock";

import VideoChunk from "../core/VideoChunk.js";
import Transition from "../entity/Transition.js";
import logger from "../lib/logger.js";
import util from "../lib/util.js";

/**
 * 分块视频
 */
export default class ChunkVideo extends VideoChunk {

    /** @type {string} - 页面URL */
    url;
    /** @type {boolean} - 是否自动启动渲染 */
    autostartRender;
    /** @type {boolean} - 是否输出页面控制台日志 */
    consoleLog;
    /** @type {boolean} - 是否输出视频预处理日志 */
    videoPreprocessLog;
    /** @type {Function} - 页面获取函数 */
    #pageAcquireFn = null;
    /** @type {AsyncLock} - 异步锁 */
    #asyncLock = new AsyncLock();

    /**
     * 构造函数
     * 
     * @param {Object} options - 分块视频选项
     * @param {string} options.url - 页面URL
     * @param {string} options.outputPath - 输出路径
     * @param {number} options.width - 视频宽度
     * @param {number} options.height - 视频高度
     * @param {number} options.duration - 视频时长
     * @param {number} [options.fps=30] - 视频帧率
     * @param {number} [options.index=0] - 分块索引
     * @param {Transition} [options.transition] - 进入下一视频分块的转场
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
     * @param {boolean} [options.autostartRender=true] - 是否自动启动渲染，如果为false请务必在页面中执行 captureCtx.start()
     * @param {boolean} [options.consoleLog=false] - 是否开启控制台日志输出
     * @param {boolean} [options.videoPreprocessLog=false] - 是否开启视频预处理日志输出
     */
    constructor(options = {}) {
        super(options);
        assert(_.isObject(options), "options must be Object");
        const { url, autostartRender, consoleLog, videoPreprocessLog } = options;
        assert(util.isURL(url), `url ${url} is not valid URL`);
        assert(_.isUndefined(autostartRender) || _.isBoolean(autostartRender), "autostartRender must be boolean");
        assert(_.isUndefined(consoleLog) || _.isBoolean(consoleLog), "consoleLog must be boolean");
        this.url = url;
        this.autostartRender = _.defaultTo(autostartRender, true);
        this.consoleLog = _.defaultTo(consoleLog, false);
        this.videoPreprocessLog = _.defaultTo(videoPreprocessLog, false);
    }

    /**
     * 启动合成
     */
    start() {
        this.#asyncLock.acquire("start", () => this.#synthesize())
            .catch(err => logger.error(err));
    }

    /**
     * 合成处理
     */
    async #synthesize() {
        const page = await this.#acquirePage();
        try {
            const { url, width, height, fps, duration } = this;
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
            page.on("audioAdd", options => {
                this.addAudio(options);
                this.emit("audioAdd", options);
            });
            page.on("audioUpdate", (audioId, options) => {
                this.updateAudio(audioId, options);
                this.emit("audioUpdate", options);
            })
            // 设置视窗宽高
            await page.setViewport({
                width,
                height
            });
            // 跳转到您希望渲染的页面，您可以考虑创建一个本地的Web服务器提供页面以提升加载速度和安全性
            await page.goto(url);
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