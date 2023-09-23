import assert from "assert";
import _ from "lodash";

import Preprocessor from "../base/Preprocessor.js";
import VideoProcessTask from "./VideoProcessTask.js";
import VideoConfig from "./VideoConfig.js";
import { VIDEO_CODEC, VIDEO_CODEC_MAP } from "../../lib/const.js";

/**
 * 视频预处理器
 */
export default class VideoPreprocessor extends Preprocessor {

    /** @type {string} - 视频编码器（必须为H264编码器） */
    videoCodec;
    
    /**
     * 构造函数
     * 
     * @param {Object} options - 预处理器选项
     * @param {number} [options.parallelDownloads=10] - 并行下载数量
     * @param {number} [options.parallelProcess=10] - 并行处理数量
     * @param {string} [optiond.videoCodec="libx264"] - 视频编码器
     */
    constructor(options) {
        super(options);
        const { videoCodec } = options;
        assert(_.isUndefined(videoCodec) || _.isString(videoCodec), "videoCodec must be string");
        assert(_.isUndefined(videoCodec) || VIDEO_CODEC_MAP.H264.includes(videoCodec), `videoCodec ${videoCodec} is not H264 encoder`);
        this.videoCodec = _.defaultTo(videoCodec, VIDEO_CODEC.CPU.H264);
    }

    /**
     * 发起处理
     * 
     * @param {VideoConfig} config - 视频配置
     */
    async process(config) {
        assert(config instanceof VideoConfig, "process config must be VideoConfig");
        return await super.process(config);
    }

    /**
     * 创建视频处理任务
     * 
     * @param {Object} options - 处理任务选项
     * @returns {VideoProcessTask} - 处理任务对象
     */
    createProcessTask(options) {
        const task = new VideoProcessTask({ ...options, videoCodec: this.videoCodec });
        this.addProcessTask(task);
        return task;
    }

}