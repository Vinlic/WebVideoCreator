import assert from "assert";
import _ from "lodash";

import ProcessTask from "../base/ProcessTask.js";

export default class VideoProcessTask extends ProcessTask {
    
    filePath;
    seekStart;
    seekEnd;
    loop;
    muted;

    /**
     * 构造函数
     * 
     * @param {Object} options - 任务选项
     * @param {string} options.filePath - 视频文件路径
     * @param {number} [options.seekStart=0] - 裁剪开始时间点（毫秒）
     * @param {number} [options.seekEnd] - 裁剪结束时间点（毫秒）
     * @param {boolean} [options.loop=false] - 是否循环播放
     * @param {boolean} [options.muted=false] - 是否静音
     * @param {number} [options.retryFetchs=2] - 重试次数
     * @param {number} [options.retryDelay=1000] - 重试延迟
     */
    constructor(options) {
        console.log(options);
        super(options);
        const { filePath, seekStart, seekEnd, loop, muted } = options;
        assert(_.isString(filePath), "filePath must be string");
        assert(_.isUndefined(seekStart) || _.isFinite(seekStart), "seekStart must be number");
        assert(_.isUndefined(seekEnd) || _.isFinite(seekEnd), "seekEnd must be number");
        assert(_.isUndefined(loop) || _.isBoolean(loop), "loop must be number");
        assert(_.isUndefined(muted) || _.isBoolean(muted), "muted must be number");
        this.filePath = filePath;
        this.seekStart = seekStart;
        this.seekEnd = seekEnd;
        this.loop = loop;
        this.muted = muted;
    }

    async process() {
        
        return Buffer.from("123");
    }

}