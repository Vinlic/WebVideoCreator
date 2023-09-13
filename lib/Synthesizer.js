import assert from "assert";
import ffmpeg from "fluent-ffmpeg";
import _ from "lodash";

import { VCODEC } from "./Codecs.js";
import Audio from "./Audio.js";

// 合成器计数
let synthesizerIndex = 1;

/**
 * 合成器基类
 */
export default class Synthesizer {

    // 视频编码器映射
    static VCODEC = VCODEC;

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
    #timeline = [];

    /**
     * 构造函数
     * 
     * @param {Object} options - 合成器选项
     * @param {number} options.width - 视频宽度
     * @param {number} options.height - 视频高度
     * @param {number} options.fps - 视频合成帧率
     * @param {string} [options.outputPath] - 导出视频路径
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
     */
    constructor(options) {
        if(new.target === Synthesizer)
            throw new Error("This is base class, please use FrameSynthesizer or ChunkSynthesizer");
        assert(_.isObject(options), "Synthesizer options must be object");
        const { outputPath, width, height, fps, coverPath, coverCaptureTime,
                liveUrl, videoCodec,
                videoQuality, videoBitrate, pixelFormat, audioCodec,
                audioBitrate, volume } = options;
        assert(_.isString(outputPath) || _.isString(liveUrl), "outputPath or liveUrl must be string");
        assert(_.isFinite(width), "width must be number");
        assert(_.isFinite(height), "height must be number");
        assert(_.isFinite(fps), "synthesis fps must be number");
        assert(_.isUndefined(coverPath) || _.isString(coverPath), "coverPath must be string");
        assert(_.isUndefined(coverCaptureTime) || _.isFinite(coverCaptureTime), "coverCaptureTime must be number");
        assert(_.isUndefined(videoCodec) || _.isString(videoCodec), "videoCodec must be string");
        assert(_.isUndefined(videoQuality) || _.isFinite(videoQuality), "videoQuality must be number");
        assert(_.isUndefined(videoBitrate) || _.isString(videoBitrate), "videoBitrate must be string");
        assert(_.isUndefined(pixelFormat) || _.isString(pixelFormat), "pixelFormat must be string");
        assert(_.isUndefined(audioCodec) || _.isString(audioCodec), "audioCodec must be string");
        assert(_.isUndefined(audioBitrate) || _.isFinite(audioBitrate), "audioBitrate must be number");
        assert(_.isUndefined(volume) || _.isFinite(volume), "volume must be number");
        this.outputPath = outputPath;
        this.width = width;
        this.height = height;
        this.fps = fps;
        this.coverPath = coverPath;
        this.coverCaptureTime = coverCaptureTime;
        this.liveUrl = liveUrl;
        this.videoCodec = videoCodec;
        this.videoQuality = videoQuality;
        this.videoBitrate = videoBitrate;
        this.pixelFormat = pixelFormat;
        this.audioCodec = audioCodec;
        this.audioBitrate = audioBitrate;
        this.volume = volume;
    }

    /**
     * 添加音频
     * 
     * @param {Audio} audio - 音频对象
     */
    addAudio(audio) {
        if(!(audio instanceof Audio))
            audio = new Audio(audio);
        this.#timeline.push(audio);
    }

    createCommand() {
        return ffmpeg();
    }

}