import fs from "fs-extra";
import assert from "assert";
import _ from "lodash";
import ffmpeg from "fluent-ffmpeg";
import { PassThrough } from "stream";
import AsyncLock from "async-lock";

import ProcessTask from "../base/ProcessTask.js";
import Audio from "../../entity/Audio.js";
import util from "../../lib/util.js";
import { VIDEO_ENCODER } from "../../lib/const.js";

// 处理异步锁
const processLock = new AsyncLock();

export default class VideoProcessTask extends ProcessTask {

    /** @type {string} - 视频文件路径 */
    filePath;
    /** @type {string} - 视频格式 */
    format;
    /** @type {string} - 蒙版视频文件路径 */
    maskFilePath;
    /** @type {string} - 音频文件路径 */
    audioFilePath;
    /** @type {string} - 已转码文件路径 */
    transcodedFilePath;
    /** @type {number} - 开始播放时间点（毫秒） */
    startTime;
    /** @type {number} - 结束播放时间点（毫秒） */
    endTime;
    /** @type {number} - 音频ID */
    audioId;
    /** @type {number} - 裁剪开始时间点（毫秒） */
    seekStart;
    /** @type {number} - 裁剪结束时间点（毫秒） */
    seekEnd;
    /** @type {number} - 音频淡入时长（毫秒） */
    fadeInDuration;
    /** @type {number} - 音频淡出时长（毫秒） */
    fadeOutDuration;
    /** @type {boolean} - 是否自动播放 */
    autoplay;
    /** @type {boolean} - 是否循环播放 */
    loop;
    /** @type {boolean} - 是否静音 */
    muted;
    /** @type {string} - 视频编码器 */
    videoEncoder;

    /**
     * 构造函数
     * 
     * @param {Object} options - 任务选项
     * @param {string} options.filePath - 视频文件路径
     * @param {string} options.format - 视频格式
     * @param {number} options.startTime - 开始播放时间点（毫秒）
     * @param {number} options.endTime - 结束播放时间点（毫秒）
     * @param {number} options.audioId - 音频ID
     * @param {number} [options.seekStart=0] - 裁剪开始时间点（毫秒）
     * @param {number} [options.seekEnd] - 裁剪结束时间点（毫秒）
     * @param {number} [options.fadeInDuration] - 音频淡入时长（毫秒）
     * @param {number} [options.fadeOutDuration] - 音频淡出时长（毫秒）
     * @param {boolean} [options.autoplay] - 是否自动播放
     * @param {boolean} [options.loop=false] - 是否循环播放
     * @param {boolean} [options.muted=false] - 是否静音
     * @param {string} [options.videoEncoder="libx264"] - 视频编码器
     * @param {number} [options.retryFetchs=2] - 重试次数
     * @param {number} [options.retryDelay=1000] - 重试延迟
     */
    constructor(options) {
        super(options);
        const { filePath, format, startTime, endTime, audioId, seekStart, seekEnd, fadeInDuration, fadeOutDuration, autoplay, loop, muted, videoEncoder } = options;
        assert(_.isString(filePath), "filePath must be string");
        assert(_.isString(format) && ["mp4", "webm"].includes(format), "format must be string");
        assert(_.isFinite(startTime), "startTime must be number");
        assert(_.isFinite(endTime), "endTime must be number");
        assert(_.isFinite(audioId), "audioId must be number");
        assert(_.isUndefined(seekStart) || _.isFinite(seekStart), "seekStart must be number");
        assert(_.isUndefined(seekEnd) || _.isFinite(seekEnd), "seekEnd must be number");
        assert(_.isUndefined(fadeInDuration) || _.isFinite(fadeInDuration), "fadeInDuration must be number");
        assert(_.isUndefined(fadeOutDuration) || _.isFinite(fadeOutDuration), "fadeOutDuration must be number");
        assert(_.isUndefined(autoplay) || _.isBoolean(autoplay), "autoplay must be number");
        assert(_.isUndefined(loop) || _.isBoolean(loop), "loop must be number");
        assert(_.isUndefined(muted) || _.isBoolean(muted), "muted must be number");
        assert(_.isUndefined(videoEncoder) || _.isString(videoEncoder), "videoEncoder must be string");
        this.filePath = filePath;
        this.format = format;
        this.startTime =startTime;
        this.endTime = endTime;
        this.audioId = audioId;
        this.seekStart = _.defaultTo(seekStart, 0);
        this.seekEnd = seekEnd;
        this.fadeInDuration = fadeInDuration;
        this.fadeOutDuration = fadeOutDuration;
        this.autoplay = autoplay;
        this.loop = _.defaultTo(loop, false);
        this.muted = _.defaultTo(muted, false);
        this.videoEncoder = _.defaultTo(videoEncoder, VIDEO_ENCODER.CPU.H264);
    }

    /**
     * 处理视频
     */
    async process() {
        // 非静音音频需分离音频文件
        !this.muted && await this.#separateAudioFile();
        if (this.format == "webm") {
            // 视频转码为H264
            await this.#videoTranscoding();
            // 检查是否具有透明通道
            const hasAlphaChannel = await util.checkMediaHasAplhaChannel(this.filePath);
            // 具备透明通道将分离出蒙版视频
            hasAlphaChannel && await this.#videoMaskExtract();
        }
        let buffer;
        let maskBuffer = null;
        // 当存在seek时进行裁剪
        if(this.hasClip) {
            buffer = await this.#videoClip(this.outputFilePath);
            if(this.maskFilePath)
                maskBuffer = await this.#videoClip(this.maskFilePath);
        }
        else {
            buffer = await fs.readFile(this.outputFilePath);
            if(this.maskFilePath)
                maskBuffer = await fs.readFile(this.maskFilePath);
        }
        return {
            // 添加到合成器的音频对象
            audio: this.audioFilePath ? new Audio({
                id: this.audioId,
                path: this.audioFilePath,
                startTime: this.startTime,
                endTime: this.endTime,
                seekStart: this.seekStart,
                seekEnd: this.seekEnd,
                fadeInDuration: this.fadeInDuration,
                fadeOutDuration: this.fadeOutDuration,
                loop: this.loop
            }) : null,
            // video_preprocess响应回传到浏览器的数据
            buffer: this.#packData({
                buffer,
                maskBuffer,
                hasMask: !!this.maskFilePath,
                hasAudio: this.hasAudio,
                hasClip: this.hasClip
            })
        }
    }

    /**
     * 视频裁剪
     */
    async #videoClip(filePath) {
        const cliper = ffmpeg(filePath);
        let seekEnd = this.seekEnd;
        const duration = (seekEnd || Infinity) - (this.seekStart || 0);
        const endTime = this.startTime + duration;
        if(endTime != Infinity && endTime > this.endTime)
            seekEnd = seekEnd - (this.endTime - endTime);
        this.seekStart && cliper.addInputOption("-ss", util.millisecondsToHmss(this.seekStart));
        seekEnd && cliper.addInputOption("-to", util.millisecondsToHmss(this.seekEnd));
        const buffers = [];
        const stream = new PassThrough();
        const receivePromise = new Promise((resolve, reject) => {
            stream.on("data", data => buffers.push(data));
            stream.once("error", reject)
            stream.once("end", () => resolve(Buffer.concat(buffers)));
        });
        await new Promise((resolve, reject) => {
            cliper
                .addOutputOption("-c:v", "copy")
                .addOutputOption("-an")
                .addOutputOption('-movflags frag_keyframe+empty_moov')
                .toFormat("mp4")
                .once("error", reject)
                .once("end", resolve)
                .pipe(stream, { end: true });
        });
        return await receivePromise;
    }

    /**
     * 透明视频蒙版提取
     */
    async #videoMaskExtract() {
        return await processLock.acquire(`videoMaskExtract-${util.crc32(this.filePath)}`, async () => {
            const maskFilePath = `${this.filePath}_mask.mp4`
            if (!this.ignoreCache && await fs.pathExists(maskFilePath)) {
                this.maskFilePath = maskFilePath;
                return;
            }
            const videoEncoderName = await util.getMediaVideoCodecName(this.filePath);
            let codec;
            switch (videoEncoderName) {
                case "vp8":
                    codec = "libvpx";
                    break;
                case "vp9":
                    codec = "libvpx-vp9";
                    break;
                default:
                    throw new Error(`Video file ${this.filePath} codec name ${videoEncoderName} is not supported`);
            }
            await new Promise((resolve, reject) => {
                ffmpeg(this.filePath)
                    .addInputOption(`-c:v ${codec}`)
                    .videoFilter("alphaextract")
                    .addOutputOption(`-c:v ${this.videoEncoder}`)
                    .addOutputOption("-an")
                    .outputOption("-movflags +faststart")
                    .addOutput(maskFilePath)
                    .once("end", resolve)
                    .once("error", reject)
                    .run();
            });
            this.maskFilePath = maskFilePath;
        });
    }

    /**
     * 视频转码
     */
    async #videoTranscoding() {
        return await processLock.acquire(`videoTranscoding-${util.crc32(this.filePath)}`, async () => {
            const transcodedFilePath = `${this.filePath}_transcoded.mp4`;
            if (!this.ignoreCache && await fs.pathExists(transcodedFilePath)) {
                this.transcodedFilePath = transcodedFilePath;
                return;
            }
            const videoEncoderName = await util.getMediaVideoCodecName(this.filePath);
            let codec;
            switch (videoEncoderName) {
                case "vp8":
                    codec = "libvpx";
                    break;
                case "vp9":
                    codec = "libvpx-vp9";
                    break;
                default:
                    throw new Error(`Video file ${this.filePath} codec name ${videoEncoderName} is not supported`);
            }
            await new Promise((resolve, reject) => {
                ffmpeg(this.filePath)
                    .addInputOption(`-c:v ${codec}`)
                    .addOutputOption(`-c:v ${this.videoEncoder}`)
                    .addOutputOption("-an")
                    .addOutputOption("-crf 18")
                    .outputOption("-movflags +faststart")
                    .addOutput(transcodedFilePath)
                    .once("start", cmd => logger.info(cmd))
                    .once("end", resolve)
                    .once("error", reject)
                    .run();
            });
            this.transcodedFilePath = transcodedFilePath;
        });
    }

    /**
     * 分离视频的音频
     */
    async #separateAudioFile() {
        return await processLock.acquire(`separateAudioFile-${util.crc32(this.filePath)}`, async () => {
            const audioFormat = "mp3";
            const audioFilePath = `${this.filePath}.${audioFormat}`;
            if (this.ignoreCache || !await fs.pathExists(audioFilePath)) {
                const hasAudioTrack = await util.separateVideoAudioTrack(this.filePath, audioFilePath, {
                    audioEncoder: "libmp3lame",
                    outputFormat: audioFormat
                });
                if (hasAudioTrack)
                    this.audioFilePath = audioFilePath;
            }
            else
                this.audioFilePath = audioFilePath;
        });
    }

    /**
     * 封装数据
     * 将对象封装为Buffer才能回传浏览器页面处理
     * 
     * @param {Object} data - 数据对象
     * @returns {Buffer} - 已封装Buffer
     */
    #packData(data) {
        const obj = {};
        const buffers = [];
        let bufferOffset = 0;
        for (let key in data) {
            if (_.isBuffer(data[key])) {
                obj[key] = ["buffer", bufferOffset, bufferOffset + data[key].length];
                bufferOffset += data[key].length;
                buffers.push(data[key]);
            }
            else
                obj[key] = data[key];
        }
        const objBuffer = Buffer.from(JSON.stringify(obj))
        buffers.unshift(objBuffer);
        buffers.unshift(Buffer.from(`${objBuffer.length}!`));
        return Buffer.concat(buffers);
    }

    get outputFilePath() {
        return this.transcodedFilePath || this.filePath;
    }

    /**
     * 是否包含音频
     */
    get hasAudio() {
        return !!this.audioFilePath;
    }

    /**
     * 是否裁剪
     */
    get hasClip() {
        return this.seekStart > 0 || this.seekEnd > 0;
    }

}