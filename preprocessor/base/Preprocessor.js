import assert from "assert";
import _ from "lodash";

import DownloadTask from "./DownloadTask.js";
import ProcessTask from "./ProcessTask.js";
import logger from "../../lib/logger.js";

/**
 * 预处理器
 */
export default class Preprocessor {

    /** @type {number} - 并行下载数量 */
    parallelDownloads;
    /** @type {number} - 并行处理数量 */
    parallelProcess;
    /** @type {DownloadTask[]} - 下载队列 */
    #downloadQueue = [];
    /** @type {ProcessTask} - 处理队列 */
    #processQueue = [];
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
        assert(_.isObject(options), "VideoPreprocessor options must be Object");
        const { parallelDownloads, parallelProcess } = options;
        assert(_.isUndefined(parallelDownloads) || _.isFinite(parallelDownloads), "parallelDownloads must be number");
        assert(_.isUndefined(parallelProcess) || _.isFinite(parallelProcess), "parallelProcess must be number");
        this.parallelDownloads = _.defaultTo(parallelDownloads, 10);
        this.parallelProcess = _.defaultTo(parallelProcess, 10);
        // 调度下载队列
        this.#dispatchDownloadQueue();
        // 调度处理队列
        this.#dispatchProcessQueue();
        // 调度任务
        this.#dispatchTasks();
    }

    /**
     * 发起处理
     * 
     * @param {Object} options - 任务选项
     */
    async process(options) {
        const downloadTask = this.createDownloadTask(options);
        const downloadResult = await new Promise((resolve, reject) => {
            downloadTask
                .once("completed", resolve)
                .once("error", reject);
        });
        const processTask = this.createProcessTask({ ...downloadResult, ...options });
        const result = await new Promise((resolve, reject) => {
            processTask
                .once("completed", resolve)
                .once("error", reject);
        });
        return result;
    }

    /**
     * 创建下载任务
     * 
     * @param {Object} options - 下载任务选项
     * @returns {DownloadTask} - 下载任务对象
     */
    createDownloadTask(options) {
        const task = new DownloadTask(options);
        this.addDownloadTask(task);
        return task;
    }

    /**
     * 添加处理任务
     * 
     * @param {Task} task - 任务对象
     */
    addDownloadTask(task) {
        assert(task instanceof DownloadTask, "task must be DownloadTask instance");
        this.#downloadQueue.push(task);
        if (this.#downloadQueueResumeCallback) {
            const fn = this.#downloadQueueResumeCallback;
            this.#downloadQueueResumeCallback = null;
            fn();
        }
    }

    /**
     * 创建处理任务
     * 
     * @param {Object} options - 处理任务选项
     * @returns {ProcessTask} - 处理任务对象
     */
    createProcessTask(options) {
        const task = new ProcessTask(options);
        this.addProcessTask(task);
        return task;
    }

    /**
     * 添加处理任务
     * 
     * @param {Task} task - 任务对象
     */
    addProcessTask(task) {
        assert(task instanceof ProcessTask, "task must be ProcessTask instace");
        this.#processQueue.push(task);
        if (this.#processQueueResumeCallback) {
            const fn = this.#processQueueResumeCallback;
            this.#processQueueResumeCallback = null;
            fn();
        }
    }

    /**
     * 调度下载队列
     */
    #dispatchDownloadQueue() {
        (async () => {
            const task = this.#downloadQueue.shift();
            if (!task || this.downloadTasks.length >= this.parallelDownloads) {
                await new Promise(resolve => this.#downloadQueueResumeCallback = resolve);
                return this.#dispatchDownloadQueue();
            }
            this.downloadTasks.push(task);
            this.#dispatchDownloadQueue();
        })()
            .catch(err => logger.error(err));
    }

    /**
     * 调度处理队列
     */
    #dispatchProcessQueue() {
        (async () => {
            const task = this.#processQueue.shift();
            if (!task || this.processTasks.length >= this.parallelProcess) {
                await new Promise(resolve => this.#processQueueResumeCallback = resolve);
                return this.#dispatchProcessQueue();
            }
            this.processTasks.push(task);
            this.#dispatchProcessQueue();
        })()
            .catch(err => logger.error(err));
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
            if (this.downloadTasks.length < this.parallelDownloads) {
                if (this.#downloadQueueResumeCallback) {
                    const fn = this.#downloadQueueResumeCallback;
                    this.#downloadQueueResumeCallback = null;
                    fn();
                }
            }
            this.processTasks = this.processTasks.filter(task => {
                if (task.canRemove())
                    return false;
                if (task.canStart())
                    task.start();
                return true;
            });
            if (this.processTasks.length < this.parallelProcess) {
                if (this.#processQueueResumeCallback) {
                    const fn = this.#processQueueResumeCallback;
                    this.#processQueueResumeCallback = null;
                    fn();
                }
            }
            setTimeout(this.#dispatchTasks.bind(this), 0);
        }
        catch (err) {
            logger.error(err);
        }
    }

}