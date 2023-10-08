import assert from "assert";
import _ from "lodash";

import Preprocessor from "../base/Preprocessor.js";
import VideoDownloadTask from "./VideoDownloadTask.js";
import VideoProcessTask from "./VideoProcessTask.js";
import VideoConfig from "./VideoConfig.js";
import { VIDEO_ENCODER, VIDEO_ENCODER_MAP } from "../../lib/const.js";
import globalConfig from "../../lib/global-config.js";

/**
 * 视频预处理器
 */
export default class VideoPreprocessor extends Preprocessor {

    /** @type {string} - 视频编码器（必须为H264编码器） */
    videoEncoder;
    
    /**
     * 构造函数
     * 
     * @param {Object} options - 预处理器选项
     * @param {number} [options.parallelDownloads=10] - 并行下载数量
     * @param {number} [options.parallelProcess=10] - 并行处理数量
     * @param {string} [optiond.videoEncoder="libx264"] - 视频编码器
     */
    constructor(options) {
        super(options);
        const { videoEncoder } = options;
        assert(_.isUndefined(videoEncoder) || _.isString(videoEncoder), "videoEncoder must be string");
        assert(_.isUndefined(videoEncoder) || VIDEO_ENCODER_MAP.H264.includes(videoEncoder), `videoEncoder ${videoEncoder} is not H264 encoder`);
        this.videoEncoder = _.defaultTo(videoEncoder, _.defaultTo(globalConfig.mp4Encoder, VIDEO_ENCODER.CPU.H264));
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
     * 创建视频下载任务
     * 
     * @param {Object} options - 下载任务选项
     * @returns {VideoDownloadTask} - 下载任务对象
     */
    createDownloadTask(options) {
        const task = new VideoDownloadTask(options);
        this.addDownloadTask(task);
        return task;
    }

    /**
     * 创建视频处理任务
     * 
     * @param {Object} options - 处理任务选项
     * @returns {VideoProcessTask} - 处理任务对象
     */
    createProcessTask(options) {
        const task = new VideoProcessTask({ ...options, videoEncoder: this.videoEncoder });
        this.addProcessTask(task);
        return task;
    }

}