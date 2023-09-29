import path from "path";
import assert from "assert";
import uniqid from "uniqid";
import _ from "lodash";

import Synthesizer from "./Synthesizer.js";
import { BITSTREAM_FILTER } from "../lib/const.js";
import Transition from "../entity/Transition.js";
import Audio from "../entity/Audio.js";
import util from "../lib/util.js";

/**
 * 视频分块
 */
export default class VideoChunk extends Synthesizer {

    /** @type {Transition} - 进入下一视频分块的转场 */
    transition;

    /**
     * 构造函数
     * 
     * @param {Object} options - 序列帧合成器选项
     * @param {number} options.width - 视频宽度
     * @param {number} options.height - 视频高度
     * @param {number} options.fps - 视频合成帧率
     * @param {number} options.duration - 视频时长
     * @param {Transition} [options.transition] - 进入下一视频分块的转场
     * @param {string} [options.videoEncoder] - 视频编码器
     * @param {number} [options.videoQuality] - 视频质量（0-100）
     * @param {string} [options.videoBitrate] - 视频码率（设置码率将忽略videoQuality）
     * @param {string} [options.pixelFormat] - 像素格式（yuv420p/yuv444p/rgb24）
     * @param {string} [options.audioEncoder] - 音频编码器
     * @param {string} [options.audioBitrate] - 音频码率
     * @param {number} [options.parallelWriteFrames=10] - 并行写入帧数
     */
    constructor(options = {}) {
        super(options);
        const { transition } = options;
        this.outputPath = _.defaultTo(this.outputPath, path.join(this.tmpDirPath, `${uniqid("chunk_")}.ts`));
        assert(util.getPathExtname(this.outputPath) == "ts", "Video chunk output path extname must be .ts");
        transition && this.setTransition(transition);
        this.coverCapture = false;
        this.format = "mpegts";
        const encodingType = this.getVideoEncodingType();
        assert(_.isString(BITSTREAM_FILTER[encodingType]), `Video encoder ${this.videoEncoder} does not support use in VideoChunk, only support encoding using H264, H265, and VP9`)
    }

    /**
     * 添加音频
     * 
     * @param {Audio} audio - 音频对象
     */
    addAudio(audio) {
        if (!(audio instanceof Audio))
            audio = new Audio(audio);
        this.audios.push(audio);
        return audio;
    }

    /**
     * 设置合成下一视频分块时的转场
     * 
     * @param {Transition} transition - 转场对象
     */
    setTransition(transition) {
        if (_.isString(transition))
            transition = new Transition({ id: transition });
        else if (!(transition instanceof Transition))
            transition = new Transition(transition);
        this.transition = transition;
    }

    /**
     * 创建视频编码器
     * 
     * @protected
     * @returns {FfmpegCommand} - 编码器
     */
    _createVideoEncoder() {
        const encodingType = this.getVideoEncodingType();
        const bitstreamFilter = BITSTREAM_FILTER[encodingType];
        const vencoder = super._createVideoEncoder();
        vencoder.outputOption(`-bsf:v ${bitstreamFilter}`)
        return vencoder;
    }

    /**
     * 判断是否VideoChunk
     * 
     * @protected
     * @returns {boolean} - 是否为VideoChunk
     */
    _isVideoChunk() {
        return true;
    }

    /**
     * 获取转场ID
     */
    get transitionId() {
        return this.transition ? this.transition.id : 0;
    }

    /**
     * 获取转场时长
     */
    get transitionDuration() {
        return this.transition ? this.transition.duration : 0;
    }

}