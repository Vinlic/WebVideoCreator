import assert from "assert";
import { PassThrough } from "stream";
import ffmpeg from "fluent-ffmpeg";
import _ from "lodash";

import Synthesizer from "./Synthesizer.js";
import util from "./util.js";

/** @typedef {import('fluent-ffmpeg').FfmpegCommand} FfmpegCommand */

/**
 * 序列帧合成器
 */
export default class FrameSynthesizer extends Synthesizer {

    /** @type {number} - 并行写入帧数 */
    parallelWriteFrames;
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
     * @param {number} [options.parallelWriteFrames=10] - 并行写入帧数
     */
    constructor(options) {
        super(options);
        const { parallelWriteFrames } = options;
        assert(_.isUndefined(parallelWriteFrames) || _.isFinite(parallelWriteFrames), "parallelWriteFrames must be number");
        this.parallelWriteFrames = _.defaultTo(parallelWriteFrames, 10);
        this.#frameBuffers = new Array(this.parallelWriteFrames);
        this.#targetFrameCount = Math.floor((this.duration || 0) / 1000 * this.fps);
    }

    /**
     * 启动合成
     */
    start() {
        this.#frameCount = 0;
        (async () => {
            await this.initResources();
            await new Promise((resolve, reject) => {
                this.#createVideoEncoder()
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
     * 创建视频编码器
     * 
     * @returns {FfmpegCommand} - 编码器
     */
    #createVideoEncoder() {
        const { width, height, fps, outputPath, format, videoCodec,
            videoBitrate, videoQuality, pixelFormat } = this;
        if (!this.#pipeStream)
            this.#pipeStream = new PassThrough();
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
            // 使用主要配置
            .outputOption("-profile:v main")
            // 使用中等预设
            .outputOption("-preset medium")
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
     * 获取已处理帧数
     * 
     * @returns {number} - 已处理帧数
     */
    get frameCount() {
        return this.#frameCount;
    }

}