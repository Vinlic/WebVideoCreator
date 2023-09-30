import "colors";
import assert from "assert";
import fs from "fs-extra";
import ffmpeg from "fluent-ffmpeg";
import cliProgress from "cli-progress";
import _ from "lodash";

import Synthesizer from "./Synthesizer.js";
import VideoChunk from "./VideoChunk.js";
import Transition from "../entity/Transition.js";
import logger from "../lib/logger.js";

/**
 * 视频分块合成器
 */
export default class ChunkSynthesizer extends Synthesizer {

    /** @type {VideoChunk[]} - 视频块列表 */
    chunks = [];

    /**
     * 构造函数
     * 
     * @param {Object} options - 序列帧合成器选项
     * @param {string} options.outputPath - 导出视频路径
     * @param {number} options.width - 视频宽度
     * @param {number} options.height - 视频高度
     * @param {number} options.duration - 视频时长
     * @param {VideoChunk[]} options.chunks - 视频分块列表
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
        options.duration = 0;
        super(options);
        const { chunks } = options;
        assert(_.isUndefined(chunks) || _.isArray(chunks), "chunks must be VideoChunk[]");
        if (this.showProgress) {
            this._cliProgress = new cliProgress.MultiBar({
                hideCursor: true,
                format: `[${"{bar}".cyan}] {percentage}% | {value}/{total} | {eta_formatted} | {filename}`,
            }, cliProgress.Presets.shades_grey);
        }
        chunks && chunks.forEach(chunk => this.input(chunk));
    }

    /**
     * 输入视频分块
     * 
     * @param {VideoChunk} chunk - 视频分块
     * @param {Transition} [transition] - 进入下一分块的转场对象
     */
    input(chunk, transition) {
        _.isFinite(this.width) && (chunk.width = _.defaultTo(chunk.width, this.width));
        _.isFinite(this.height) && (chunk.height = _.defaultTo(chunk.height, this.height));
        _.isFinite(this.fps) && (chunk.fps = _.defaultTo(chunk.fps, this.fps));
        if (!(chunk instanceof VideoChunk))
            chunk = new VideoChunk(chunk);
        assert(chunk.width == this.width, "input chunk width does not match the previous block");
        assert(chunk.height == this.height, "input chunk height does not match the previous block");
        assert(chunk.fps == this.fps, "input chunk fps does not match the previous block");
        transition && chunk.setTransition(_.isString(transition) ? { id: transition } : transition);
        if (this.showProgress)
            chunk.attachCliProgress(this._cliProgress);
        this.chunks.push(chunk);
        this.width = chunk.width;
        this.height = chunk.height;
        this.fps = chunk.fps;
        this.duration += chunk.getOutputDuration();
        this._targetFrameCount += chunk.targetFrameCount;
    }

    /**
     * 启动合成
     */
    start() {
        assert(this.chunks.length > 0, "There is no VideoChunk that can be synthesized");
        this._startupTime = performance.now();
        let offsetTime = 0
        const chunksRenderPromises = [];
        this.chunks.forEach(chunk => {
            chunk.audios.forEach(audio => {
                if (_.isFinite(audio.startTime))
                    audio.startTime += offsetTime;
                if (_.isFinite(audio.endTime))
                    audio.endTime += offsetTime;
                this.addAudio(audio);
            });
            // 分块未完成时先进行渲染
            !chunk.isCompleted() && chunksRenderPromises.push(this.renderChunk(chunk, offsetTime));
            offsetTime += chunk.getOutputDuration();
        });
        // 等待分块渲染完成再开始合成流程
        Promise.all(chunksRenderPromises)
            .then(() => super.start())
            .catch(err => this._emitError(err));
    }

    /**
     * 渲染分块
     * 
     * @param {VideoChunk} chunk - 视频分块
     * @param {number} offsetTime - 分块偏移时间点
     */
    async renderChunk(chunk, offsetTime) {
        if (chunk.isCompleted())
            return;
        return await new Promise((resolve, reject) => {
            chunk.on("audioAdd", options => {
                const audio = this.addAudio(options);
                audio.startTime += offsetTime;
                audio.endTime += offsetTime;
            });
            chunk.on("audioUpdate", options => {
                if (_.isFinite(options.startTime))
                    options.startTime += offsetTime;
                if (_.isFinite(options.endTime))
                    options.endTime += offsetTime;
                this.updateAudio(options);
            });
            chunk.on("progress", () => this._emitChunksProgress());
            chunk.once("completed", resolve);
            chunk.once("error", reject);
            chunk.isReady() && chunk.start();
        });
    }

    /**
     * 发送进度事件
     */
    _emitChunksProgress() {
        const { progress: totalProgress, frameCount: totalFrameCount } = this.chunks.reduce((total, chunk) => {
            total.progress += chunk.progress;
            total.frameCount += chunk.frameCount;
            return total;
        }, {
            progress: 0,
            frameCount: 0
        });
        this.progress = Math.floor(totalProgress / this.chunks.length * 0.95 * 1000) / 1000;
        this._frameCount = totalFrameCount;
        this.emit("progress", this.progress * 0.95, totalFrameCount, this._targetFrameCount);
    }

    /**
     * 发送进度事件
     * 
     * @protected
     * @param {number} value - 进度值
     */
    _emitProgress(value, frameCount, targetFrameCount) {
        if (value < 0)
            return;
        let progress = this.progress + Math.floor(value * 0.05 * 1000) / 1000;
        if (progress > 100)
            progress = 100;
        if (this.showProgress) {
            if(this._cliProgress instanceof cliProgress.MultiBar) {
                this._cliProgress.stop();
                this._cliProgress = new cliProgress.SingleBar({
                    hideCursor: true,
                    format: `[${"{bar}".green}] {percentage}% | {value}/{total} | {eta_formatted} | {filename}`,
                }, cliProgress.Presets.shades_grey);
            }
            if (!this._cliProgress.started) {
                logger.log(`Waiting to merge ${this.chunks.length} chunks and audio synthesis...`);
                this._cliProgress.start(targetFrameCount, 0);
                this._cliProgress.started = true;
            }
            this._cliProgress.update(frameCount, { filename: this.name });
        }
        this.emit("progress", progress, this._frameCount, this._targetFrameCount);
    }

    /**
     * 发送已完成事件
     * 
     * @protected
     */
    _emitCompleted() {
        Promise.all(this.chunks.map(chunk => chunk.autoremove && fs.remove(chunk.outputPath)))
            .catch(err => logger.error(err));
        super._emitCompleted();
    }

    /**
     * 创建视频编码器
     * 
     * @protected
     * @returns {FfmpegCommand} - 编码器
     */
    _createVideoEncoder() {
        const { chunks, width, height, _swapFilePath, format,
            videoEncoder, videoBitrate, videoQuality, pixelFormat, attachCoverPath } = this;
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
        // 输入命令集合
        const inputs = [];
        // 复合过滤器
        let complexFilter = '';
        // 时长偏移
        let durationOffset = 0;
        // 上一个输出索引
        let lastOutput = null;
        for (let i = 0; i < chunks.length; i++) {
            // 当前分块
            const chunk = chunks[i];
            // 获取上一个分块
            const lastChunk = i > 0 ? chunks[i - 1] : null;
            // 如果存在上一分块则处理转场
            if (lastChunk) {
                // 当前输入索引
                const index = inputs.length ? inputs.length - 1 : 0;
                // 如果上一分块存在转场则填充输入和过滤器
                if (lastChunk.transition) {
                    // 将此分块路径添加到输入
                    inputs.push(chunk.outputPath);
                    // 如果存在上层输出则使用否则以当前块作为输入
                    const input = lastOutput || `[${index}:v]`;
                    // 输出索引
                    const output = `[v${index}]`;
                    // 获取上一分块转场参数
                    let { id: transtiionId, duration: transitionDuration } = lastChunk.transition;
                    // 上一分块时长减去当前转场时长获得偏移量
                    durationOffset += (lastChunk.duration - transitionDuration);
                    // 添加转场到复合过滤器
                    complexFilter += `${input}[${index + 1}:v]xfade=transition=${transtiionId}:duration=${Math.floor(transitionDuration / 1000 * 100) / 100}:offset=${Math.floor(durationOffset / 1000 * 100) / 100}${output};`;
                    // 设置当前输出索引用于下次处理
                    lastOutput = output;
                }
                // 如果没有转场则直接拼接加快合成速度
                else {
                    // 偏移上一分块时长
                    durationOffset += lastChunk.duration;
                    // 如果最后一个输入不存在或者输入非拼接态将处理为拼接
                    if (!inputs[index] || inputs[index].indexOf("concat") !== 0)
                        inputs[index] = `concat:${lastChunk.outputPath}|${chunk.outputPath}`;
                    else
                        inputs[index] += `|${chunk.outputPath}`;  //拼到拼接态字符串尾部
                }
            }
            // 不存在上一分块直接作为输入
            else
                inputs.push(chunk.outputPath);
        }
        // 将所有分块输出路径输入
        inputs.forEach(input => vencoder.addInput(input));
        // 获取任务封面路径
        if (attachCoverPath) {
            vencoder.addInput(attachCoverPath);
            const output = `[v${inputs.length}]`;
            complexFilter += `[${inputs.length}:v]scale=${width}:${height}[cover];${lastOutput || "[0:v]"}[cover]overlay=repeatlast=0${output};`;
            inputs.push(attachCoverPath);
            lastOutput = output;
        }
        // 如采用复合过滤器将应用
        if (complexFilter) {
            vencoder.complexFilter(complexFilter.replace(`${lastOutput};`, `,format=${pixelFormat}[output]`));
            vencoder.outputOption("-map [output]");
        }
        // 获取编码类型
        const encodingType = this.getVideoEncodingType();
        if (encodingType == "H264" || encodingType == "H265") {
            // 使用主要配置
            vencoder.outputOption("-profile:v main");
            // 使用中等预设
            vencoder.outputOption("-preset medium");
        }
        vencoder
            // 指定视频编码器
            .videoCodec(videoEncoder)
            // 移动MOOV头到前面
            .outputOption("-movflags +faststart")
            // 指定输出格式
            .toFormat(format)
            .addOutput(_swapFilePath);
        return vencoder;
    }

    /**
     * 获取已合成视频时长
     * 
     * @returns {number} - 已合成视频时长
     */
    getOutputDuration() {
        return this.duration;
    }

}