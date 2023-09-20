import assert from "assert";
import _ from "lodash";

import util from "../lib/util.js";
import DownloadTask from "./task/DownloadTask.js";
import ProcessTask from "./task/ProcessTask.js";
import DemuxTask from "./task/DemuxTask.js";

export default class VideoPreprocessor {

    /** @type {VideoConfig[]} - 视频配置列表 */
    configs;
    /** @type {number} - 并行下载数量 */
    parallelDownloads;
    /** @type {number} - 并行处理数量 */
    parallelProcess;
    /** @type {number} - 并行解复用数量 */
    parallelDemuxs;
    /** @type {DownloadTask[]} - 下载队列 */
    downloadQueue = [];
    /** @type {ProcessTask} - 处理队列 */
    processQueue = [];
    /** @type {DemuxTask} - 解复用队列 */
    demuxQueue = [];
    #downloadQueueResumeCallback;
    /** @type {DownloadTask[]} - 下载任务列表 */
    downloadTasks = [];
    /** @type {ProcessTask[]} - 处理任务列表 */
    processTasks = [];
    /** @type {DemuxTask[]} - 解复用任务列表 */
    demuxTasks = [];
   

    constructor(options) {
        assert(_.isObject(options), "VideoPreprocessor options must be Object");
        const { configs } = options;
        assert(_.isArray(configs), "configs must be VideoConfig[]");
        this.configs = configs;
    }

    start() {
        this.configs.forEach(config => this.downloadQueue.push(new DownloadTask(config)));
        this.dispatchDownloadQueue();
        this.dispatch();
    }

    dispatchDownloadQueue() {
        (async () => {
            const task = this.downloadQueue.shift();
            if (!task)
                return true;
            if(this.downloadTasks.length >= this.parallelDownloads)
                await new Promise(resolve => this.#downloadQueueResumeCallback = resolve);
            this.downloadTasks.push(task);
            return false;
        })()
            .then(stop => !stop && this.dispatchDownloadQueue())
            .catch(err => console.error("download queue dispatch error:", err));
    }

    dispatch() {
        this.downloadTasks = this.downloadTasks.filter(task => {
            if(task.canRemove())
                return false;
            if(task.canStart())
                task.start();
            return true;
        });
        if(this.downloadTasks.length < this.parallelDownloads)
            this.#downloadQueueResumeCallback && this.#downloadQueueResumeCallback();
        setTimeout(this.dispatch.bind(this), 500);
    }

}