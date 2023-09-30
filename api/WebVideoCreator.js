import assert from "assert";
import _ from "lodash";

import globalConfig from "../lib/global-config.js";
import { VIDEO_ENCODER } from "../lib/const.js";
import ResourcePool from "../core/ResourcePool.js";
import SingleVideo from "./SingleVideo.js";
import ChunkVideo from "./ChunkVideo.js";
import MultiVideo from "./MultiVideo.js";
import logger from "../lib/logger.js";
import cleaner from "../lib/cleaner.js";

export default class WebVideoCreator {

    /** @type {ResourcePool} - 资源池 */
    pool = null;
    /** @type {boolean} - 是否已配置 */
    #configured = false;

    /**
     * 配置引擎
     * 
     * @param {globalConfig} config - 配置对象
     */
    config(config = {}) {
        for (let key in globalConfig) {
            if (!_.isUndefined(config[key]))
                globalConfig[key] = config[key];
        }
        const { browserUseGPU, numBrowserMax, numBrowserMin, numPageMax, numPageMin, mp4Encoder } = globalConfig;
        if (!browserUseGPU)
            logger.warn("browserUseGPU is turn off, recommended to turn it on to improve rendering performance");
        if (Object.values(VIDEO_ENCODER.CPU).includes(mp4Encoder))
            logger.warn(`Recommended to use video hard coder to accelerate video synthesis, currently used is [${globalConfig.mp4Encoder}]`);
        this.pool = new ResourcePool({
            numBrowserMin,
            numBrowserMax,
            browserOptions: {
                numPageMin,
                numPageMax
            },
            videoPreprocessorOptions: {
                videoEncoder: mp4Encoder
            }
        });
        this.#configured = true;
    }

    /**
     * 创建单幕视频
     * 
     * @param {Object} options - 单幕视频选项
     * @param {string} options.url - 页面URL
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
     * @param {boolean} [options.showProgress=false] - 是否在命令行展示进度
     * @param {boolean} [options.autostartRender=true] - 是否自动启动渲染，如果为false请务必在页面中执行 captureCtx.start()
     * @param {boolean} [options.consoleLog=false] - 是否开启控制台日志输出
     * @param {boolean} [options.videoPreprocessLog=false] - 是否开启视频预处理日志输出
     */
    createSingleVideo(options) {
        assert(this.#configured, "WebVideoCreator has not been configured yet, please execute config() first");
        const singleVideo = new SingleVideo(options);
        // 注册获取页面函数
        singleVideo.onPageAcquire(async () => await this.pool.acquirePage());
        return singleVideo;
    }

    /**
     * 创建多幕视频
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
     * @param {boolean} [options.showProgress=false] - 是否在命令行展示进度
     */
    createMultiVideo(options) {
        assert(this.#configured, "WebVideoCreator has not been configured yet, please execute config() first");
        const multiVideo = new MultiVideo(options);
        // 注册获取页面函数
        multiVideo.onPageAcquire(async () => await this.pool.acquirePage())
        return multiVideo;
    }

    /**
     * 创建分块视频
     * 
     * @param {Object} options - 分块视频选项
     * @param {string} options.url - 页面URL
     * @param {string} options.outputPath - 输出路径
     * @param {number} options.width - 视频宽度
     * @param {number} options.height - 视频高度
     * @param {number} options.duration - 视频时长
     * @param {number} [options.fps=30] - 视频帧率
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
     * @param {boolean} [options.showProgress=false] - 是否在命令行展示进度
     * @param {boolean} [options.autostartRender=true] - 是否自动启动渲染，如果为false请务必在页面中执行 captureCtx.start()
     * @param {boolean} [options.consoleLog=false] - 是否开启控制台日志输出
     * @param {boolean} [options.videoPreprocessLog=false] - 是否开启视频预处理日志输出
     */
    createChunkVideo(options) {
        assert(this.#configured, "WebVideoCreator has not been configured yet, please execute config() first");
        const chunkVideo = new ChunkVideo(options);
        // 注册获取页面函数
        chunkVideo.onPageAcquire(async () => await this.pool.acquirePage());
        return chunkVideo;
    }

    /** 清理浏览器缓存 */
    cleanBrowserCache = cleaner.cleanBrowserCache.bind(cleaner);

    /** 清理预处理缓存 */
    cleanPreprocessCache = cleaner.cleanPreprocessCache.bind(cleaner);

    /** 清理合成缓存 */
    cleanSynthesizeCache = cleaner.cleanSynthesizeCache.bind(cleaner);

    /** 清理本地字体缓存 */
    cleanLocalFontCache = cleaner.cleanLocalFontCache.bind(cleaner);

}