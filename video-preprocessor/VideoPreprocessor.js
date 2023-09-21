import assert from "assert";
import EventEmitter from "eventemitter3";
import _ from "lodash";

import DownloadTask from "./task/DownloadTask.js";
import ProcessTask from "./task/ProcessTask.js";

/**
 * 视频预处理器
 */
export default class VideoPreprocessor extends EventEmitter {

    /** @type {number} - 并行下载数量 */
    parallelDownloads;
    /** @type {number} - 并行处理数量 */
    parallelProcess;
    /** @type {DownloadTask[]} - 下载队列 */
    downloadQueue = [];
    /** @type {ProcessTask} - 处理队列 */
    processQueue = [];
    /** @type {Function} - 下载队列恢复回调函数 */
    #downloadQueueResumeCallback;
    /** @type {Function} - 处理队列恢复回调函数 */
    #processQueueResumeCallback;
    /** @type {DownloadTask[]} - 下载任务列表 */
    downloadTasks = [];
    /** @type {ProcessTask[]} - 处理任务列表 */
    processTasks = [];

    /**
     * 构造函数
     * 
     * @param {Object} options - 预处理器选项
     * @param {number} [options.parallelDownloads=10] - 并行下载数量
     * @param {number} [options.parallelProcess=10] - 并行处理数量
     */
    constructor(options) {
        super();
        assert(_.isObject(options), "VideoPreprocessor options must be Object");
        const { parallelDownloads, parallelProcess } = options;
        assert(_.isUndefined(parallelDownloads) || _.isFinite(parallelDownloads), "parallelDownloads must be number");
        assert(_.isUndefined(parallelProcess) || _.isFinite(parallelProcess), "parallelProcess must be number");
        this.parallelDownloads = _.defaultTo(parallelDownloads, 10);
        this.parallelProcess = _.defaultTo(parallelProcess, 10);
    }

    /**
     * 启动处理
     */
    start() {
        // this.configs.forEach(config => this.downloadQueue.push(new DownloadTask(config)));
        this.#dispatchDownloadQueue();
        this.#dispatchProcessQueue();
        this.#dispatchTasks();
    }

    createTask() {
        
    }

    /**
     * 发送错误事件
     * 
     * @param {Error} err - 错误对象
     */
    #emitError(err) {
        this.emit("error", err);
    }

    /**
     * 调度下载队列
     */
    #dispatchDownloadQueue() {
        (async () => {
            const task = this.downloadQueue.shift();
            if (!task)
                return true;
            if (this.downloadTasks.length >= this.parallelDownloads)
                await new Promise(resolve => this.#downloadQueueResumeCallback = resolve);
            this.downloadTasks.push(task);
            return false;
        })()
            .then(stop => !stop && this.#dispatchDownloadQueue())
            .catch(err => this.#emitError(err));
    }

    /**
     * 调度处理队列
     */
    #dispatchProcessQueue() {
        (async () => {
            const task = this.processQueue.shift();
            if (!task)
                return true;
            if (this.processTasks.length >= this.parallelProcess)
                await new Promise(resolve => this.#processQueueResumeCallback = resolve);
            this.processTasks.push(task);
            return false;
        })()
            .then(stop => !stop && this.#dispatchProcessQueue())
            .catch(err => this.#emitError(err));
    }

    /**
     * 任务调度
     */
    #dispatchTasks() {
        try {
            this.downloadTasks = this.downloadTasks.filter(task => {
                if (task.canRemove())
                    return false;
                if (task.canStart())
                    task.start();
                return true;
            });
            if (this.downloadTasks.length < this.parallelDownloads)
                this.#downloadQueueResumeCallback && this.#downloadQueueResumeCallback();
            this.processTasks = this.processTasks.filter(task => {
                if (task.canRemove())
                    return false;
                if (task.canStart())
                    task.start();
                return true;
            });
            if (this.processTasks.length < this.parallelProcess)
                this.#processQueueResumeCallback && this.#processQueueResumeCallback();
            setTimeout(this.#dispatchTasks.bind(this), 500);
        }
        catch(err) {
            this.#emitError(err);
        }
    }

}