import assert from "assert";
import { PassThrough } from "stream";
import Ffmpeg from "fluent-ffmpeg";
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
    #frameIndex = 0;
    /** @type {Buffer[]} */
    #frameBuffers = null;
    #frameBufferIndex = 0;
    /** @type {PassThrough} - 帧写入管道流 */
    #pipeStream = null;
    /** @type {FfmpegCommand} - 编码器 */
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
    }

    /**
     * 启动合成
     */
    start() {
        this.#frameIndex = 0;
        (async () => {
            await this.initResources();
            this.#createEncoder()
                .once("start", cmd => console.log(cmd))
                // .on("progress", e => console.log(e.percent || 0))
                .once("error", err => console.error(err))
                .once("end", () => console.log("OK"))
                .run();
        })()
        .catch(err => console.error(err));
    }

    /**
     * 终止合成
     */
    abort() {
        this.#closeEncoder(true);
    }

    /**
     * 输入帧
     * 
     * @param {Buffer} buffer - 帧缓冲区
     */
    input(buffer) {
        if(!this.#pipeStream)
            this.#pipeStream = new PassThrough();
        this.#frameBuffers[this.#frameBufferIndex] = buffer;
        this.#frameIndex++;
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
        if (this.#frameBufferIndex > 0)
            this.#pipeStream.write(Buffer.concat(this.#frameBuffers));
        this.#frameBufferIndex = 0;
        this.#pipeStream.end();  //结束帧图流
        this.#pipeStream = null;
    }

    /**
     * 创建编码器
     * 
     * @returns {FfmpegCommand} - 编码器
     */
    #createEncoder() {
        const { width, height, fps, duration, outputPath, format, videoCodec, videoBitrate,
            videoQuality, pixelFormat, audioCodec, audioBitrate, volume: videoVolume } = this;
        if(!this.#pipeStream)
            this.#pipeStream = new PassThrough();
        const encoder = Ffmpeg();
        // 设置视频码率将忽略质量设置
        if (videoBitrate)
            encoder.videoBitrate(videoBitrate);
        else {
            // 计算总像素量
            const pixels = width * height;
            // 根据像素总量设置视频码率
            encoder.videoBitrate(`${(2560 / 921600 * pixels) * (videoQuality / 100)}k`);
        }
        encoder
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
            // 设置视频时长
            .setDuration(duration / 1000)
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
            .addOutput(outputPath);
        if (this.audios.length) {
            // 指定音频编码器
            encoder.audioCodec(audioCodec);
            // 指定音频码率
            audioBitrate && encoder.audioBitrate(audioBitrate);
            // 生成音频时间轴的复合过滤器参数
            let outputs = "";
            const complexFilter = this.audios.reduce((result, audio, index) => {
                const { path, url, loop, startTime, endTime, duration, volume, seekStart, seekEnd, fadeInDuration, fadeOutDuration } = audio;
                const _volume = Math.floor(((volume / 100) * (videoVolume / 100)) * 100) / 100;
                const output = `a${index}`;
                encoder.addInput(path || url);
                loop && encoder.inputOption("-stream_loop", "-1");
                !loop && seekStart && encoder.addInputOption("-ss", util.millisecondsToHmss(seekStart));  //截取开始时间点
                !loop && seekEnd && encoder.addInputOption("-to", util.millisecondsToHmss(seekEnd));  //截取结束时间点
                const fadeIn = fadeInDuration ? `,afade=t=in:st=${startTime / 1000}:d=${fadeInDuration / 1000}` : "";
                const fadeOut = fadeOutDuration ? `,afade=t=out:st=${((loop ? duration : (endTime || duration)) - fadeOutDuration) / 1000}:d=${fadeOutDuration / 1000}` : "";
                outputs += `[${output}]`;
                return result + `[${1 + index}]adelay=${startTime}|${startTime},volume=${_volume}${fadeIn}${fadeOut}[${output}];`;
            }, "") + `${outputs}amix=inputs=${this.audios.length}:normalize=0`;
            // 应用符合过滤器
            encoder.complexFilter(complexFilter);
        }
        this.#encoder = encoder;
        return encoder;
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
    

}