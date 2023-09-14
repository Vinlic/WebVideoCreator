import path from "path";
import assert from "assert";
import EventEmitter from "eventemitter3";
import { PassThrough } from "stream";
import ffmpeg from "fluent-ffmpeg";
import _ from "lodash";

import { SUPPORT_FORMAT, VCODEC, ACODEC, FORMAT_VCODEC_MAP, FORMAT_ACODEC_MAP } from "./Preset.js";
import Audio from "./Audio.js";
import util from "./util.js";

/** @typedef {import('fluent-ffmpeg').FfmpegCommand} FfmpegCommand */

// 合成器计数
let synthesizerIndex = 1;

/**
 * 序列帧合成器
 */
export default class FrameSynthesizer extends EventEmitter {

    // 视频编码器映射
    static VCODEC = VCODEC;
    // 音频编码器映射
    static ACODEC = ACODEC;

    /** @type {string} - 合成器ID */
    id = `Synthesizer@${synthesizerIndex++}`;
    /** @type {string} - 导出封面路径 */
    coverPath;
    /** @type {number} - 封面捕获时间点（毫秒）*/
    coverCaptureTime;
    /** @type {string} - 导出视频路径 */
    outputPath;
    /** @type {string} - 直播推理地址 */
    liveUrl;
    /** @type {number} - 视频合成帧率 */
    fps;
    /** @type {number} - 视频宽度 */
    width;
    /** @type {number} - 视频高度 */
    height;
    /** @type {number} - 视频时长 */
    duration;
    /** @type {string} - 视频格式（mp4/webm） */
    format;
    /** @type {string} - 视频编码器 */
    videoCodec;
    /** @type {number} - 视频质量（0-100） */
    videoQuality;
    /** @type {string} - 视频码率（如8M，设置码率将忽略videoQuality） */
    videoBitrate;
    /** @type {string} - 像素格式（yuv420p/yuv444p/rgb24） */
    pixelFormat;
    /** @type {string} - 音频编码器（aac/ogg） */
    audioCodec;
    /** @type {string} - 音频码率 */
    audioBitrate;
    /** @type {numer} - 视频音量（0-100） */
    volume;
    /** @type {Audio[]} - 音频列表 */
    #audios = [];
    /** @type {number} - 帧计数 */
    #frameCount = 0;
    /** @type {number} - 目标帧数 */
    #targetFrameCount = 0;
    /** @type {Buffer[]} - 帧缓冲区列表 */
    #frameBuffers = null;
    /** @type {Buffer[]} - 帧缓冲区指针 */
    #frameBufferIndex = 0;
    /** @type {PassThrough} - 帧写入管道流 */
    #pipeStream = null;
    /** @type {FfmpegCommand} - 当前编码器 */
    #encoder = null;

    /**
     * 构造函数
     * 
     * @param {Object} options - 序列帧合成器选项
     * @param {number} options.width - 视频宽度
     * @param {number} options.height - 视频高度
     * @param {number} options.fps - 视频合成帧率
     * @param {string} [options.outputPath] - 导出视频路径
     * @param {number} [options.duration] - 视频时长
     * @param {string} [options.format] - 导出视频格式
     * @param {string} [options.coverPath] - 导出封面路径
     * @param {number} [options.coverCaptureTime] - 封面捕获时间点（毫秒）
     * @param {string} [options.liveUrl] - 直播推流地址
     * @param {string} [options.videoCodec] - 视频编码器
     * @param {number} [options.videoQuality] - 视频质量（0-100）
     * @param {string} [options.videoBitrate] - 视频码率（设置码率将忽略videoQuality）
     * @param {string} [options.pixelFormat] - 像素格式（yuv420p/yuv444p/rgb24）
     * @param {string} [options.audioCodec] - 音频编码器
     * @param {string} [options.audioBitrate] - 音频码率
     * @param {number} [options.volume] - 视频音量（0-100）
     * @param {number} [options.parallelWriteFrames=10] - 并行写入帧数
     */
    constructor(options) {
        super();
        assert(_.isObject(options), "Synthesizer options must be object");
        const { width, height, fps, duration, format,
            outputPath, coverPath, coverCaptureTime, liveUrl,
            videoCodec, videoQuality, videoBitrate, pixelFormat,
            audioCodec, audioBitrate, volume, parallelWriteFrames } = options;
        assert(_.isFinite(width), "width must be number");
        assert(_.isFinite(height), "height must be number");
        assert(_.isFinite(fps), "synthesis fps must be number");
        assert(_.isString(outputPath) || _.isString(liveUrl), "outputPath or liveUrl must be string");
        assert(_.isUndefined(duration) || _.isFinite(duration), "synthesis duration must be number");
        assert(_.isUndefined(coverPath) || _.isString(coverPath), "coverPath must be string");
        assert(_.isUndefined(format) || SUPPORT_FORMAT.includes(format), `format ${format} is not supported`);
        assert(_.isUndefined(coverCaptureTime) || _.isFinite(coverCaptureTime), "coverCaptureTime must be number");
        assert(_.isUndefined(videoCodec) || _.isString(videoCodec), "videoCodec must be string");
        assert(_.isUndefined(videoQuality) || _.isFinite(videoQuality), "videoQuality must be number");
        assert(_.isUndefined(videoBitrate) || _.isString(videoBitrate), "videoBitrate must be string");
        assert(_.isUndefined(pixelFormat) || _.isString(pixelFormat), "pixelFormat must be string");
        assert(_.isUndefined(audioCodec) || _.isString(audioCodec), "audioCodec must be string");
        assert(_.isUndefined(audioBitrate) || _.isFinite(audioBitrate), "audioBitrate must be string");
        assert(_.isUndefined(volume) || _.isFinite(volume), "volume must be number");
        assert(_.isUndefined(parallelWriteFrames) || _.isFinite(parallelWriteFrames), "parallelWriteFrames must be number");
        if (!format && outputPath) {
            const _format = path.extname(outputPath).substring(1);
            if (!_format)
                throw new Error(`Unable to recognize output video format: ${outputPath}`);
            if (!SUPPORT_FORMAT.includes(_format))
                throw new Error(`Unsupported output video format: ${_format}`);
            this.format = _format;
        }
        else
            this.format = format;
        this.width = width;
        this.height = height;
        this.fps = fps;
        this.outputPath = outputPath;
        this.duration = duration;
        this.coverPath = coverPath;
        this.coverCaptureTime = coverCaptureTime;
        this.liveUrl = liveUrl;
        this.videoCodec = _.defaultTo(videoCodec, FORMAT_VCODEC_MAP[this.format][0] || "libx264");
        this.videoQuality = _.defaultTo(videoQuality, 80);
        this.videoBitrate = videoBitrate;
        this.pixelFormat = _.defaultTo(pixelFormat, "yuv420p");
        this.audioCodec = _.defaultTo(audioCodec, FORMAT_ACODEC_MAP[this.format][0] || "aac");
        this.audioBitrate = audioBitrate;
        this.volume = _.defaultTo(volume, 100);
        this.parallelWriteFrames = _.defaultTo(parallelWriteFrames, 10);
        this.#frameBuffers = new Array(this.parallelWriteFrames);
        if(_.isFinite(this.duration))
            this.#targetFrameCount = Math.floor(this.duration / 1000 * this.fps);
    }

    /**
     * 启动合成
     */
    start() {
        this.#frameCount = 0;
        if (!this.#pipeStream)
            this.#pipeStream = new PassThrough();
        (async () => {
            await this.#initResources();
            await new Promise((resolve, reject) => {
                this.createVideoEncoder()
                    .once("start", cmd => console.log(cmd))
                    .on("progress", e => {
                        if (!this.#targetFrameCount)
                            return this.#emitProgress(0);
                        const progres = e.frames / this.#targetFrameCount;
                        this.#emitProgress(progres * (this.audioSynthesis ? 98 : 100));
                    })
                    .once("error", reject)
                    .once("end", resolve)
                    .run();
            });
            if (this.audioSynthesis) {
                await new Promise((resolve, reject) => {
                    this.#createAudioEncoder()
                        .once("start", cmd => console.log(cmd))
                        .on("progress", e => this.#emitProgress(98 + ((e.percent || 0) * 0.02)))
                        .once("error", reject)
                        .once("end", resolve)
                        .run();
                });
            }
            this.#emitCompleted();
        })()
            .catch(err => this.#emitError(err));
    }

    /**
     * 终止合成
     */
    abort() {
        this.#drain();
        this.#closeEncoder(true);
        this.#removeListeners();
    }

    /**
     * 输入帧
     * 
     * @param {Buffer} buffer - 帧缓冲区
     */
    input(buffer) {
        if (!this.#pipeStream)
            this.#pipeStream = new PassThrough();
        this.#frameBuffers[this.#frameBufferIndex] = buffer;
        this.#frameCount++;
        if (++this.#frameBufferIndex < this.parallelWriteFrames)
            return;
        this.#pipeStream.write(Buffer.concat(this.#frameBuffers));
        this.#frameBufferIndex = 0;
    }

    /**
     * 结束帧输入
     */
    endInput() {
        this.#drain();
        this.#closeEncoder();
    }

    /**
     * 初始化资源
     */
    async #initResources() {
        await Promise.all(this.audios.map(audio => audio.init()));
    }

    /**
     * 将缓冲区剩余帧写入管道
     */
    #drain() {
        if (!this.#pipeStream)
            return;
        if (this.#frameBufferIndex > 0)
            this.#pipeStream.write(Buffer.concat(this.#frameBuffers));
        this.#frameBufferIndex = 0;
        this.#pipeStream.end();  //结束帧图流
        this.#pipeStream = null;
    }

    /**
     * 发送进度事件
     * 
     * @param {number} value - 进度值
     */
    #emitProgress(value) {
        if (value > 100)
            value = 100;
        this.emit("progress", Math.floor(value * 1000) / 1000);
    }

    /**
     * 发送已完成时间
     */
    #emitCompleted() {
        this.#emitProgress(100);
        this.emit("completed");
        this.#removeListeners();
    }

    /**
     * 发送错误事件
     * 
     * @param {Error} err - 错误对象
     */
    #emitError(err) {
        this.emit("error", err);
    }

    /**
     * 添加音频
     * 
     * @param {Audio} audio - 音频对象
     */
    addAudio(audio) {
        if (!(audio instanceof Audio))
            audio = new Audio(audio);
        this.#audios.push(audio);
    }

    /**
     * 创建视频编码器
     * 
     * @returns {FfmpegCommand} - 编码器
     */
    createVideoEncoder() {
        const { width, height, fps, outputPath, format, videoCodec,
            videoBitrate, videoQuality, pixelFormat } = this;
        const vencoder = ffmpeg();
        // 设置视频码率将忽略质量设置
        if (videoBitrate)
            vencoder.videoBitrate(videoBitrate);
        else {
            // 计算总像素量
            const pixels = width * height;
            // 根据像素总量设置视频码率
            vencoder.videoBitrate(`${(2560 / 921600 * pixels) * (videoQuality / 100)}k`);
        }
        if(format == "mp4") {
            // 使用主要配置
            vencoder.outputOption("-profile:v main");
            // // 使用中等预设
            vencoder.outputOption("-preset medium");
        }
        vencoder
            .setSize(`${width}x${height}`)
            .addInput(this.#pipeStream)
            // 使用图像管道
            .inputFormat("image2pipe")
            // 指定输入帧率
            .inputFPS(fps)
            // 去除冗余信息
            .inputOption("-hide_banner")
            // 指定视频编码器
            .videoCodec(videoCodec)
            // 设置像素格式
            .outputOption("-pix_fmt", pixelFormat)
            // 将MOOV头移到最前面
            .outputOption("-movflags +faststart")
            // 指定输出格式
            .toFormat(format)
            // 指定输出路径
            .addOutput(this.audios.length > 0 ? `${outputPath}.tmp` : outputPath);
        this.#encoder = vencoder;
        return vencoder;
    }

    /**
     * 创建音频编码器
     * 
     * @returns {FfmpegCommand} - 编码器
     */
    #createAudioEncoder() {
        const { outputPath, format, audioCodec, audioBitrate, volume: videoVolume } = this;
        const videoDuration = Math.floor(this.#frameCount / this.fps);
        const aencoder = ffmpeg();
        // 指定音频编码器
        aencoder.audioCodec(audioCodec);
        // 指定音频码率
        audioBitrate && aencoder.audioBitrate(audioBitrate);
        aencoder
            .addInput(`${outputPath}.tmp`)
            .videoCodec("copy")
            .setDuration(videoDuration)
            .audioCodec(audioCodec)
            .outputOption("-movflags +faststart")
            .toFormat(format)
            .addOutput(outputPath);
        // 生成音频时间轴的复合过滤器参数
        let outputs = "";
        const complexFilter = this.audios.reduce((result, audio, index) => {
            const { path, url, loop, startTime, endTime, duration, volume, seekStart, seekEnd, fadeInDuration, fadeOutDuration } = audio;
            const _volume = Math.floor(((volume / 100) * (videoVolume / 100)) * 100) / 100;
            const output = `a${index}`;
            aencoder.addInput(path || url);
            loop && aencoder.inputOption("-stream_loop", "-1");
            !loop && seekStart && aencoder.addInputOption("-ss", util.millisecondsToHmss(seekStart));  //截取开始时间点
            !loop && seekEnd && aencoder.addInputOption("-to", util.millisecondsToHmss(seekEnd));  //截取结束时间点
            const fadeIn = fadeInDuration ? `,afade=t=in:st=${startTime / 1000}:d=${fadeInDuration / 1000}` : "";
            const fadeOut = fadeOutDuration ? `,afade=t=out:st=${((loop ? duration : (endTime || duration)) - fadeOutDuration) / 1000}:d=${fadeOutDuration / 1000}` : "";
            outputs += `[${output}]`;
            return result + `[${1 + index}]adelay=${startTime}|${startTime},volume=${_volume}${fadeIn}${fadeOut}[${output}];`;
        }, "") + `${outputs}amix=inputs=${this.audios.length}:normalize=0`;
        // 应用符合过滤器
        aencoder.complexFilter(complexFilter);
        this.#encoder = aencoder;
        return aencoder;
    }

    /**
     * 关闭编码器
     * 
     * @param {boolean} abort - 是否强制终止
     */
    #closeEncoder(abort = false) {
        if (!this.#encoder)
            return;
        // 如果为强制终止则移除结束事件
        abort && this.#encoder.removeAllListeners("end");
        // 强制退出
        if (this.#encoder.ffmpegProc)
            this.#encoder.ffmpegProc.stdin.write("q");
        this.#encoder = null;
    }

    reset() {
        this.#frameBufferIndex = 0;
        this.#frameBuffers = new Array(this.parallelWriteFrames);
        this.#frameCount = 0;
        this.#closeEncoder(true);
        this.#pipeStream = null;
        this.#removeListeners();
    }

    /**
     * 移除监听器
     */
    #removeListeners() {
        this.removeAllListeners("completed");
        this.removeAllListeners("progress");
        this.removeAllListeners("error");
    }

    /**
     * 设置encoder
     */
    set encoder(value) {
        this.#encoder = value;
    }

    /**
     * 获取encoder
     */
    get encoder() {
        return this.#encoder;
    }

    /**
     * 获取管道流
     */
    get pipeStream() {
        return this.#pipeStream;
    }
    
    /**
     * 获取已处理帧数
     * 
     * @returns {number} - 已处理帧数
     */
    get frameCount() {
        return this.#frameCount;
    }

    /**
     * 获取音频列表
     * 
     * @returns {Audio[]} - 音频列表
     */
    get audios() {
        return this.#audios;
    }

    /**
     * 获取是否合成音频
     * 
     * @returns {boolean} - 是否合成yinp
     */
    get audioSynthesis() {
        return this.#audios.length > 0;
    }

}