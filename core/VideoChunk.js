import path from "path";
import assert from "assert";
import uniqid from "uniqid";
import _ from "lodash";

import Synthesizer from "./Synthesizer.js";
import { BITSTREAM_FILTER } from "../lib/const.js";
import Transition from "../entity/Transition.js";

/**
 * 视频分块
 */
export default class VideoChunk extends Synthesizer {

    /** @type {number} - 分块索引 */
    index;
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
     * @param {number} [options.index=0] - 分块索引
     * @param {Transition} [options.transition] - 进入下一视频分块的转场
     * @param {string} [options.videoEncoder] - 视频编码器
     * @param {number} [options.videoQuality] - 视频质量（0-100）
     * @param {string} [options.videoBitrate] - 视频码率（设置码率将忽略videoQuality）
     * @param {string} [options.pixelFormat] - 像素格式（yuv420p/yuv444p/rgb24）
     * @param {string} [options.audioEncoder] - 音频编码器
     * @param {string} [options.audioBitrate] - 音频码率
     * @param {number} [options.parallelWriteFrames=10] - 并行写入帧数
     */
    constructor(options) {
        options.outputPath = "";
        super(options);
        const { index, transition } = options;
        this.index = _.defaultTo(index, 0);
        transition && this.setTransition(transition);
        this.coverCapture = false;
        this.outputPath = path.join(this.tmpDirPath, `${uniqid("chunk_")}.ts`);
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
    }

    /**
     * 设置分块索引，用于乱序插入ChunkSynthesizer时保持顺序
     * 
     * @param {number} - 分块index
     */
    setIndex(index) {
        this.index = index;
    }

    /**
     * 设置合成下一视频分块时的转场
     * 
     * @param {Transition} transition - 转场对象
     */
    setTransition(transition) {
        if(_.isString(transition))
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