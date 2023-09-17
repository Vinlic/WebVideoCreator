import path from "path";
import assert from "assert";
import EventEmitter from "eventemitter3";
import fs from "fs-extra";
import { PassThrough } from "stream";
import ffmpeg from "fluent-ffmpeg";
import uniqid from "uniqid";
import _ from "lodash";

import {
    SUPPORT_FORMAT, FORMAT_VIDEO_CODEC_MAP,
    FORMAT_AUDIO_CODEC_MAP, VIDEO_CODEC_MAP, AUDIO_CODEC_MAP
} from "./const.js";
import Audio from "./Audio.js";
import util from "./util.js";

/** @typedef {import('fluent-ffmpeg').FfmpegCommand} FfmpegCommand */

/**
 * 序列帧合成器
 */
export default class Synthesizer extends EventEmitter {

    // 合成器状态
    static STATE = {
        // 已就绪
        READY: Symbol("READY"),
        // 合成中
        SYNTHESIZING: Symbol("SYNTHESIZING"),
        // 已完成
        COMPLETED: Symbol("COMPLETED")
    };

    /** @type {string} - 合成器ID */
    id = uniqid("video_");
    /** @type {Synthesizer.STATE} - 合成器状态 */
    state = Synthesizer.STATE.READY;
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
    /** @type {string} - 附加到视频首帧的封面路径 */
    attachCoverPath;
    /** @type {boolean} - 是否捕获封面并输出*/
    coverCapture;
    /** @type {number} - 封面捕获时间点（毫秒）*/
    coverCaptureTime;
    /** @type {string} - 封面捕获格式（jpg/png/bmp） */
    coverCaptureFormat;
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
    /** @type {numer} - 并行写入帧数 */
    parallelWriteFrames;
    /** @type {numer} - 是否输出调试信息 */
    debug;
    /** @type {string} @protected - 交换文件路径 */
    _swapFilePath;
    /** @type {string} - 临时路径 */
    #tmpDirPath;
    /** @type {Audio[]} - 音频列表 */
    #audios = [];
    /** @type {number} @protected - 帧计数 */
    _frameCount = 0;
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
     * @param {number} options.duration - 视频时长
     * @param {string} [options.outputPath] - 导出视频路径
     * @param {string} [options.format] - 导出视频格式
     * @param {string} [options.attachCoverPath] - 附加到视频首帧的封面路径
     * @param {string} [options.coverCapture=false] - 是否捕获封面并输出
     * @param {number} [options.coverCaptureTime] - 封面捕获时间点（毫秒）
     * @param {string} [options.coverCaptureFormat="jpg"] - 封面捕获格式（jpg/png/bmp）
     * @param {string} [options.liveUrl] - 直播推流地址
     * @param {string} [options.videoCodec] - 视频编码器
     * @param {number} [options.videoQuality] - 视频质量（0-100）
     * @param {string} [options.videoBitrate] - 视频码率（设置码率将忽略videoQuality）
     * @param {string} [options.pixelFormat] - 像素格式（yuv420p/yuv444p/rgb24）
     * @param {string} [options.audioCodec] - 音频编码器
     * @param {string} [options.audioBitrate] - 音频码率
     * @param {number} [options.volume] - 视频音量（0-100）
     * @param {number} [options.parallelWriteFrames=10] - 并行写入帧数
     * @param {number} [options.debug=false] - 是否输出调试信息
     */
    constructor(options) {
        super();
        assert(_.isObject(options), "Synthesizer options must be object");
        const { width, height, fps, duration, format, outputPath,
            attachCoverPath, coverCapture, coverCaptureTime, coverCaptureFormat,
            liveUrl, videoCodec, videoQuality, videoBitrate, pixelFormat,
            audioCodec, audioBitrate, volume, parallelWriteFrames, debug } = options;
        assert(_.isFinite(width), "width must be number");
        assert(_.isFinite(height), "height must be number");
        assert(_.isFinite(fps), "synthesis fps must be number");
        assert(_.isFinite(duration), "synthesis duration must be number");
        assert(_.isString(outputPath) || _.isString(liveUrl), "outputPath or liveUrl must be string");
        assert(_.isUndefined(attachCoverPath) || _.isString(attachCoverPath), "attachCoverPath must be string");
        assert(_.isUndefined(format) || SUPPORT_FORMAT.includes(format), `format ${format} is not supported`);
        assert(_.isUndefined(coverCapture) || _.isBoolean(coverCapture), "coverCapture must be boolean");
        assert(_.isUndefined(coverCaptureTime) || _.isFinite(coverCaptureTime), "coverCaptureTime must be number");
        assert(_.isUndefined(coverCaptureFormat) || _.isString(coverCaptureFormat), "coverCaptureFormat must be string");
        assert(_.isUndefined(videoCodec) || _.isString(videoCodec), "videoCodec must be string");
        assert(_.isUndefined(videoQuality) || _.isFinite(videoQuality), "videoQuality must be number");
        assert(_.isUndefined(videoBitrate) || _.isString(videoBitrate), "videoBitrate must be string");
        assert(_.isUndefined(pixelFormat) || _.isString(pixelFormat), "pixelFormat must be string");
        assert(_.isUndefined(audioCodec) || _.isString(audioCodec), "audioCodec must be string");
        assert(_.isUndefined(audioBitrate) || _.isFinite(audioBitrate), "audioBitrate must be string");
        assert(_.isUndefined(volume) || _.isFinite(volume), "volume must be number");
        assert(_.isUndefined(parallelWriteFrames) || _.isFinite(parallelWriteFrames), "parallelWriteFrames must be number");
        assert(_.isUndefined(debug) || _.isBoolean(debug), "debug must be boolean");
        if (!format && outputPath) {
            const _format = path.extname(outputPath).substring(1);
            if (!_format)
                throw new Error(`Unable to recognize output video format: ${outputPath}`);
            if (!SUPPORT_FORMAT.includes(_format))
                throw new Error(`Unsupported output video format: ${_format}`);
            this.format = _format;
        }
        else if(format)
            this.format = format;
        else
            this.format = SUPPORT_FORMAT[0];
        this.width = width;
        this.height = height;
        this.fps = fps;
        this.duration = duration;
        this.outputPath = util.rootPathJoin(outputPath);
        this.attachCoverPath = util.rootPathJoin(attachCoverPath);
        this.coverCapture = _.defaultTo(coverCapture, false);
        this.coverCaptureTime = coverCaptureTime;
        this.coverCaptureFormat = _.defaultTo(coverCaptureFormat, "jpg");
        this.liveUrl = liveUrl;
        this.videoCodec = _.defaultTo(videoCodec, FORMAT_VIDEO_CODEC_MAP[this.format][0] || "libx264");
        this.videoQuality = _.defaultTo(videoQuality, 80);
        this.videoBitrate = videoBitrate;
        this.pixelFormat = _.defaultTo(pixelFormat, "yuv420p");
        this.audioCodec = _.defaultTo(audioCodec, FORMAT_AUDIO_CODEC_MAP[this.format][0] || "aac");
        this.audioBitrate = audioBitrate;
        this.volume = _.defaultTo(volume, 100);
        this.parallelWriteFrames = _.defaultTo(parallelWriteFrames, 10);
        this.debug = _.defaultTo(debug, false);
        this.#frameBuffers = new Array(this.parallelWriteFrames);
        this.#tmpDirPath = util.rootPathJoin(`tmp/synthesizer/`);
        this._swapFilePath = path.join(this.#tmpDirPath, `${uniqid("video_")}.${this.format}`);
        this.#targetFrameCount = util.durationToFrameCount(this.duration, this.fps);
    }

    /**
     * 启动合成
     */
    start() {
        this._frameCount = 0;
        if (!this.#pipeStream)
            this.#pipeStream = new PassThrough();
        assert(this.isReady(), "Synthesizer status is not READY, please reset the synthesizer: synthesizer.reset()");
        this.#setState(Synthesizer.STATE.SYNTHESIZING);
        (async () => {
            await fs.ensureDir(path.dirname(this.outputPath));
            await fs.ensureDir(this.#tmpDirPath);
            await this.#initResources();
            await new Promise((resolve, reject) => {
                this._createVideoEncoder()
                    .once("start", cmd => this.debug && console.log(cmd))
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
                    this._createAudioEncoder()
                        .once("start", cmd => this.debug && console.log(cmd))
                        .on("progress", e => this.#emitProgress(98 + ((e.percent || 0) * 0.02)))
                        .once("error", reject)
                        .once("end", resolve)
                        .run();
                });
                await fs.remove(this._swapFilePath);
            }
            this.coverCapture && await this.#captureCover();
            this.#emitCompleted();
            this.#setState(Synthesizer.STATE.COMPLETED);
        })()
            .catch(err => this.#emitError(err));
    }

    /**
     * 终止合成
     */
    abort() {
        this.#drain();
        this.#closeEncoder(true);
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
        this._frameCount++;
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
        if (!this.#pipeStream.closed)
            this.#pipeStream.end();
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
        this.emit("progress", Math.floor(value * 1000) / 1000, this._frameCount);
    }

    /**
     * 发送已完成时间
     */
    #emitCompleted() {
        this.#emitProgress(100);
        this.emit("completed");
    }

    /**
     * 发送错误事件
     * 
     * @param {Error} err - 错误对象
     */
    #emitError(err) {
        const message = err.message;
        if (message.indexOf("Error while opening encoder for output stream") != -1)
            err = new Error(`Video codec ${this.videoCodec} may not be supported, please check if your hardware supports it. Some hardware encoders may have limitations in parallel encoding (such as NVENC https://github.com/keylase/nvidia-patch)`);
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

    // /**
    //  * 添加覆盖在顶层的视频
    //  * 
    //  * @param {Audio} audio - 音频对象
    //  */
    // addVideo() {

    // }

    /**
     * 创建视频编码器
     * 
     * @protected
     * @returns {FfmpegCommand} - 编码器
     */
    _createVideoEncoder() {
        const { width, height, fps, outputPath, format, videoCodec,
            videoBitrate, videoQuality, pixelFormat, audioSynthesis,
            attachCoverPath, _swapFilePath } = this;
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
        const encodingType = this.getVideoEncodingType();
        if (encodingType == "H264" || encodingType == "H265") {
            // 使用主要配置
            vencoder.outputOption("-profile:v main");
            // 使用中等预设
            vencoder.outputOption("-preset medium");
        }
        vencoder.addInput(this.#pipeStream);
        if(attachCoverPath) {
            vencoder.addInput(attachCoverPath);
            vencoder.complexFilter(`[1:v]scale=${width}:${height}[cover];[0:v][cover]overlay=repeatlast=0,scale=w=${width}:h=${height},format=${pixelFormat}`);
        }
        else {
            vencoder
                .setSize(`${width}x${height}`)
                .outputOption("-pix_fmt", pixelFormat)
        }
        vencoder
            // 使用图像管道
            .inputFormat("image2pipe")
            // 指定输入帧率
            .inputFPS(fps)
            // 去除冗余信息
            .inputOption("-hide_banner")
            // 指定视频编码器
            .videoCodec(videoCodec)
            // 将MOOV头移到最前面
            .outputOption("-movflags +faststart")
            // 指定输出格式
            .toFormat(format)
            // 指定输出路径
            .addOutput(audioSynthesis ? _swapFilePath : outputPath);
        this.#encoder = vencoder;
        return vencoder;
    }

    /**
     * 创建音频编码器
     * 
     * @protected
     * @returns {FfmpegCommand} - 编码器
     */
    _createAudioEncoder() {
        const { outputPath, _swapFilePath, format, audioCodec,
            audioBitrate, volume: videoVolume, audios } = this;
        const aencoder = ffmpeg();
        // 指定音频编码器
        aencoder.audioCodec(audioCodec);
        // 指定音频码率
        audioBitrate && aencoder.audioBitrate(audioBitrate);
        aencoder
            .addInput(_swapFilePath)
            .videoCodec("copy")
            .setDuration(this.getOutputDuration() / 1000)
            .audioCodec(audioCodec)
            .outputOption("-movflags +faststart")
            .toFormat(format)
            .addOutput(outputPath);
        // 生成音频时间轴的复合过滤器参数
        let outputs = "";
        const complexFilter = audios.reduce((result, audio, index) => {
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
        }, "") + `${outputs}amix=inputs=${audios.length}:normalize=0`;
        // 应用符合过滤器
        aencoder.complexFilter(complexFilter);
        this.#encoder = aencoder;
        return aencoder;
    }

    /**
     * 捕获封面
     */
    async #captureCover() {
        const { outputPath, coverCaptureTime, coverCaptureFormat } = this;
        assert(["jpg", "png", "bmp"].includes(coverCaptureFormat), "coverCaptureFormat must be jpg or png");
        let captureTime = 0;
        if (_.isFinite(coverCaptureTime))
            captureTime = Math.min(coverCaptureTime, this.getOutputDuration());
        else
            captureTime = this.getOutputDuration() * 0.2;
        const coverPath = path.join(path.dirname(outputPath), `${path.basename(outputPath)}.${coverCaptureFormat}`);
        await util.captureScreenshot(outputPath, coverPath, captureTime);
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

    /**
     * 获取已合成视频时长
     * 
     * @returns {number} - 已合成视频时长
     */
    getOutputDuration() {
        if(!this.fps || !this._frameCount)
            return this.duration || 0;
        return Math.floor(this._frameCount / this.fps) * 1000;
    }

    /**
     * 移除输出文件
     */
    async removeOutputFile() {
        const { outputPath, coverCaptureFormat } = this;
        const coverPath = path.join(path.dirname(outputPath), `${path.basename(outputPath)}.${coverCaptureFormat}`);
        await fs.remove(outputPath);
        await fs.remove(coverPath);
    }

    /**
     * 重置合成器
     */
    reset() {
        this.#frameBufferIndex = 0;
        this.#frameBuffers = new Array(this.parallelWriteFrames);
        this._frameCount = 0;
        this.#closeEncoder(true);
        if (this.#pipeStream && !this.#pipeStream.closed)
            this.#pipeStream.end();
        this.#pipeStream = null;
        this.#setState(Synthesizer.STATE.READY);
    }

    /**
     * 获取当前视频编码器编码类型
     * 
     * @returns {string} - 编码类型
     */
    getVideoEncodingType() {
        const videoCodec = this.videoCodec;
        for (let key in VIDEO_CODEC_MAP) {
            if (VIDEO_CODEC_MAP[key].includes(videoCodec))
                return key;
        }
        return null;
    }

    /**
     * 获取当前音频编码器编码类型
     * 
     * @returns {string} - 编码类型
     */
    getAudioEncodingType() {
        const audioCodec = this.audioCodec;
        for (let key in AUDIO_CODEC_MAP) {
            if (AUDIO_CODEC_MAP[key].includes(audioCodec))
                return key;
        }
        return null;
    }

    /**
     * 是否已就绪
     * 
     * @returns {boolean} - 是否已就绪
     */
    isReady() {
        return this.state == Synthesizer.STATE.READY;
    }

    /**
     * 是否合成中
     * 
     * @returns {boolean} - 是否合成中
     */
    isSynthesizing() {
        return this.state == Synthesizer.STATE.SYNTHESIZING;
    }

    /**
     * 是否已完成
     * 
     * @returns {boolean} - 是否已完成
     */
    isCompleted() {
        return this.state == Synthesizer.STATE.COMPLETED;
    }

    /**
     * 移除所有监听器
     */
    removeListeners() {
        this.removeAllListeners("completed");
        this.removeAllListeners("progress");
        this.removeAllListeners("error");
    }

    /**
     * 设置合成器状态
     * 
     * @param {Synthesizer.STATE} state - 合成器状态
     */
    #setState(state) {
        assert(_.isSymbol(state), "state must be Symbol");
        this.state = state;
    }

    /**
     * 临时目录路径
     */
    get tmpDirPath() {
        return this.#tmpDirPath;
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
        return this._frameCount;
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
     * @returns {boolean} - 是否合成音频
     */
    get audioSynthesis() {
        return !this._isVideoChunk() && this.#audios.length > 0;
    }

    /**
     * 判断是否VideoChunk
     * 
     * @protected
     * @returns {boolean} - 是否为VideoChunk
     */
    _isVideoChunk() {
        return false;
    }

}