import assert from "assert";
import ffmpeg from "fluent-ffmpeg";
import _ from "lodash";

import globalConfig from "../lib/global-config.js";
import { VIDEO_ENCODER } from "../lib/const.js";
import ResourcePool from "../core/ResourcePool.js";
import SingleVideo from "./SingleVideo.js";
import ChunkVideo from "./ChunkVideo.js";
import MultiVideo from "./MultiVideo.js";
import logger from "../lib/logger.js";
import cleaner from "../lib/cleaner.js";

/**
 * @typedef {import('puppeteer-core').WaitForOptions} WaitForOptions
 * @typedef {import('puppeteer-core').Viewport} Viewport
 */

export default class WebVideoCreator {

    /** @type {ResourcePool} - 资源池 */
    pool = null;
    /** @type {boolean} - 是否已配置 */
    #configured = false;

    /**
     * 配置引擎
     * 
     * @param {Object} config - 配置对象
     * @param {string} config.mp4Encoder - 全局MP4格式的视频编码器，默认使用libx264软编码器，建议根据您的硬件选用合适的硬编码器加速合成
     * @param {string} config.webmEncoder - 全局WEBM格式的视频编码器，默认使用libvpx软编码器，建议根据您的硬件选用合适的硬编码器加速合成
     * @param {string} config.audioEncoder - 全局音频编码器，建议采用默认的aac编码器
     * @param {boolean} config.browserUseGPU - 浏览器GPU加速开关，建议开启提高渲染性能，如果您没有GPU设备或遭遇了诡异的渲染问题则可以关闭它
     * @param {boolean} config.browserUseAngle - 浏览器是否使用Angle作为渲染后端，建议开启增强渲染跨平台兼容性和性能
     * @param {string} config.browserExecutablePath - 浏览器可执行文件路径，设置后将禁用内部的浏览器，建议您默认使用内部的浏览器以确保功能完整性
     * @param {number} config.numBrowserMin - 资源池可并行的最小浏览器实例数量
     * @param {number} config.numBrowserMax - 资源池可并行的最大浏览器实例数量
     * @param {number} config.numPageMin - 浏览器实例可并行的最小页面实例数量
     * @param {number} conifg.numPageMax - 浏览器实例可并行的最大页面实例数量
     * @param {boolean} config.debug - 开启后将输出一些WVC的调试日志
     * @param {boolean} config.browserDebug - 浏览器Debug开关，开启后将输出浏览器的运行日志，如果您想看页面的日志，请设置视频参数的consoleLog为true，而不是这个
     * @param {boolean} config.ffmpegDebug - FFmpeg Debug开关，开启后将输出每一条执行的ffmpeg命令
     * @param {boolean} config.allowUnsafeContext - 是否允许不安全的上下文，默认禁用，开启后能够导航到不安全的URL，但由于不安全上下文限制，将无法在页面中使用动态图像和内嵌视频
     * @param {boolean} config.compatibleRenderingMode - 兼容渲染模式，如果您使用MacOS请开启他，这将导致渲染效率降低40%，启用后将禁用HeadlessExperimental.beginFrame API调用改为普通的Page.screenshot
     * @param {string} config.browserVersion - 指定WVC使用的Chrome浏览器版本
     * @param {boolean} config.browserHeadless - 浏览器无头开关，建议保持开启，如果关闭请确保开启兼容渲染模式否则无法渲染，仅用于调试画面
     * @param {boolean} config.browserFrameRateLimit - 浏览器帧率限制开关，默认开启，关闭帧率限制可以提高渲染效率并支持高于60fps的动画，但这会关闭GPU垂直同步可能导致画面撕裂或其它问题
     * @param {string} config.ffmpegExecutablePath - ffmpeg可执行文件路径，设置后将禁用内部的ffmpeg-static，建议您默认使用内部的FFmpeg以确保功能完整性
     * @param {string} conifg.ffprobeExecutablePath - ffprobe可执行文件路径，设置后将禁用内部的ffprobe-static，建议您默认使用内部的ffprobe以确保功能完整性
     * @param {string} config.frameFormat - 帧图格式（jpeg/png），建议使用jpeg，png捕获较为耗时
     * @param {number} config.frameQuality - 捕获帧图质量（0-100），仅frameFormat为jpeg时有效
     * @param {number} config.beginFrameTimeout - BeginFrame捕获图像超时时间（毫秒）
     * @param {boolean} config.browserDisableDevShm - 是否禁用浏览器使用共享内存，当/dev/shm分区较小时建议开启此选项
     * @param {number} config.browserLaunchTimeout - 浏览器启动超时时间（毫秒），设置等待浏览器启动超时时间
     * @param {number} config.browserProtocolTimeout - 浏览器协议通信超时时间（毫秒），设置CDP协议通信超时时间
     * @param {string} config.userAgent - 访问页面时的用户UA
     */
    config(config = {}) {
        for (let key in globalConfig) {
            if (!_.isUndefined(config[key]))
                globalConfig[key] = config[key];
        }
        const { ffmpegExecutablePath, ffprobeExecutablePath, browserUseGPU, mp4Encoder } = globalConfig;
        // 未启用浏览器GPU发出性能警告
        if (!browserUseGPU)
            logger.warn("browserUseGPU is turn off, recommended to turn it on to improve rendering performance");
        // 未使用硬编码器发出性能警告
        if (Object.values(VIDEO_ENCODER.CPU).includes(mp4Encoder))
            logger.warn(`Recommended to use video hard coder to accelerate video synthesis, currently used is [${globalConfig.mp4Encoder}]`);
        // 设置FFmpeg可执行文件路径
        ffmpegExecutablePath && ffmpeg.setFfmpegPath(ffmpegExecutablePath);
        // 设置FFprobe可执行文件路径
        ffprobeExecutablePath && ffmpeg.setFfprobePath(ffprobeExecutablePath);
        // 实例化浏览器资源池
        this.pool = new ResourcePool();
        // 设置已配置
        this.#configured = true;
    }

    /**
     * 创建单幕视频
     * 
     * @param {Object} options - 单幕视频选项
     * @param {string} [options.url] - 页面URL
     * @param {string} [options.content] - 页面内容
     * @param {string} options.outputPath - 输出路径
     * @param {number} options.width - 视频宽度
     * @param {number} options.height - 视频高度
     * @param {number} options.duration - 视频时长
     * @param {number} [options.startTime=0] - 开始捕获时间点
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
     * @param {boolean} [options.backgroundOpacity=1] - 背景不透明度（0-1），仅webm格式支持
     * @param {boolean} [options.autostartRender=true] - 是否自动启动渲染，如果为false请务必在页面中执行 captureCtx.start()
     * @param {boolean} [options.consoleLog=false] - 是否开启控制台日志输出
     * @param {boolean} [options.videoPreprocessLog=false] - 是否开启视频预处理日志输出
     * @param {string} [options.videoDecoderHardwareAcceleration] - VideoDecoder硬件加速指示
     * @param {WaitForOptions} [options.pageWaitForOptions] - 页面等待选项
     * @param {Viewport} [options.pageViewport] - 页面视窗参数
     * @param {Function} [options.pagePrepareFn] - 页面预处理函数
     * @param {{[key: number]: Function}} [options.timeActions] - 动作序列
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
     * @param {Function} [options.pagePrepareFn] - 页面预处理函数
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
     * @param {string} [options.url] - 页面URL
     * @param {string} [options.content] - 页面内容
     * @param {string} options.outputPath - 输出路径
     * @param {number} options.width - 视频宽度
     * @param {number} options.height - 视频高度
     * @param {number} options.duration - 视频时长
     * @param {number} [options.startTime=0] - 开始捕获时间点
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
     * @param {boolean} [options.backgroundOpacity=1] - 背景不透明度（0-1），仅webm格式支持
     * @param {boolean} [options.autostartRender=true] - 是否自动启动渲染，如果为false请务必在页面中执行 captureCtx.start()
     * @param {boolean} [options.consoleLog=false] - 是否开启控制台日志输出
     * @param {boolean} [options.videoPreprocessLog=false] - 是否开启视频预处理日志输出
     * @param {string} [options.videoDecoderHardwareAcceleration] - VideoDecoder硬件加速指示
     * @param {WaitForOptions} [options.pageWaitForOptions] - 页面等待选项
     * @param {Viewport} [options.pageViewport] - 页面视窗参数
     * @param {Function} [options.pagePrepareFn] - 页面预处理函数
     * @param {{[key: number]: Function}} [options.timeActions] - 动作序列
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