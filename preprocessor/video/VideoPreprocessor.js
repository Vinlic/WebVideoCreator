import assert from "assert";
import _ from "lodash";

import Preprocessor from "../base/Preprocessor.js";
import VideoProcessTask from "./VideoProcessTask.js";
import VideoConfig from "./VideoConfig.js";

/**
 * 视频预处理器
 */
export default class VideoPreprocessor extends Preprocessor {

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
        const task = new VideoProcessTask(options);
        this.addProcessTask(task);
        return task;
    }

}