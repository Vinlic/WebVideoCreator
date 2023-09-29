import assert from "assert";
import AsyncLock from "async-lock";
import _ from "lodash";

import ChunkSynthesizer from "../core/ChunkSynthesizer.js";
import ChunkVideo from "./ChunkVideo.js";
import logger from "../lib/logger.js";

/**
 * 多幕视频
 */
export default class MultiVideo extends ChunkSynthesizer {

    /** @type {Function} - 页面获取函数 */
    #pageAcquireFn = null;
    /** @type {AsyncLock} - 异步锁 */
    #asyncLock = new AsyncLock();

    /**
     * 构造函数
     * 
     * @param {Object} options - 序列帧合成器选项
     * @param {string} options.outputPath - 导出视频路径
     * @param {number} options.width - 视频宽度
     * @param {number} options.height - 视频高度
     * @param {number} options.duration - 视频时长
     * @param {ChunkVideo[]} options.chunks - 分块视频列表
     * @param {number} [options.fps=30] - 视频合成帧率
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
     * @param {number} [options.debug=false] - 是否输出调试信息
     */
    constructor(options) {
        super(options);
    }

    /**
     * 启动合成
     */
    start() {
        this.#asyncLock.acquire("start", () => this.#synthesize())
            .catch(err => logger.error(err));
    }

    /**
     * 启动并等待
     */
    async startAndWait() {
        await this.#asyncLock.acquire("start", () => this.#synthesize());
    }

    /**
     * 输入分块视频
     * 
     * @param {ChunkVideo} chunk - 分块视频
     * @param {Transition} [transition] - 进入下一分块的转场对象
     */
    input(chunk, transition) {
        if (!(chunk instanceof ChunkVideo))
            chunk = new ChunkVideo(chunk);
        super.input(chunk, transition);
        chunk.onPageAcquire(async () => await this.#acquirePage());
    }

    /**
     * 合成处理
     */
    async #synthesize() {
        return await new Promise((resolve, reject) => {
            this.once("error", reject);
            this.once("completed", resolve);
            super.start();
        });
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