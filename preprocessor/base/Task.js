import assert from "assert";
import uniqid from "uniqid";
import EventEmitter from "eventemitter3";
import _ from "lodash";

export default class Task extends EventEmitter {

    /** 任务类型枚举 */
    static TYPE = {
        /** 未知类型任务 */
        UNKOWN: Symbol("UNKNOWN"),
        /** 下载类型任务 */
        DOWNLOAD: Symbol("DOWNLOAD"),
        /** 处理类型任务 */
        PROCESS: Symbol("PROCESS")
    };
    /** 任务状态枚举 */
    static STATE = {
        /** 等待调度 */
        WAITING: Symbol("WAITING"),
        /** 执行中 */
        EXECUTING: Symbol("EXECUTING"),
        /** 已完成 */
        COMPLETED: Symbol("COMPLETED")
    }

    /** @type {string} - 任务ID */
    id = uniqid();
    /** @type {Task.TYPE} - 任务类型 */
    type = Task.TYPE.UNKOWN;
    /** @type {Task.STATE} - 任务状态 */
    state = Task.STATE.WAITING;
    /** @type {number} - 任务进度 */
    progress = 0;
    /** @type {number} - 重试次数 */
    retryCount;
    /** @type {number} - 重试延迟（毫秒） */
    retryDelay;
    /** @type {Error[]} - 错误列表 */
    errors = [];
    /** @type {number} - 启动时间点（毫秒） */
    startupTime;
    /** @type {number} - 错误事件点（毫秒） */
    errorTime;
    /** @type {number} - 创建时间点（毫秒） */
    createTime = performance.now();
    /** @type {boolean} - 是否忽略本地缓存 */
    ignoreCache;
    /** @type {string} @protected 临时路径 */
    tmpDirPath = path.resolve("tmp/preprocessor/");

    /**
     * 构造函数
     * 
     * @param {Object} options - 任务选项
     * @param {number} [retryCount=2] - 重试次数
     * @param {number} [retryDelay=1000] - 重试延迟
     * @param {boolean} [options.ignoreCache=false] - 是否忽略本地缓存
     */
    constructor(options) {
        super();
        assert(_.isObject(options), "Task options must be Object");
        const { retryCount, retryDelay, ignoreCache } = options;
        assert(_.isUndefined(retryCount) || _.isFinite(retryCount), "retryCount must be number");
        assert(_.isUndefined(retryDelay) || _.isFinite(retryDelay), "retryDelay must be number");
        assert(_.isUndefined(ignoreCache) || _.isBoolean(ignoreCache), "ignoreCache must be boolean");
        this.retryCount = _.defaultTo(retryCount, 2);
        this.retryDelay = _.defaultTo(retryDelay, 1000);
        this.ignoreCache = ignoreCache || false;
    }

    /**
     * 启动任务
     */
    start() {
        this.#setState(Task.STATE.EXECUTING);
        this.startupTime = performance.now();
    }

    /**
     * 更新进度
     * 
     * @param {number} value - 进度值
     */
    _updateProgress(value) {
        this.progress = Math.min(value, 100);
        this.emit("progress", this.progress);
    }

    /**
     * 发射已完成事件
     * 
     * @protected
     */
    _emitCompleted(result) {
        this.#setState(Task.STATE.COMPLETED);
        this.emit("completed", result);
    }

    /**
     * 发送错误事件
     * 
     * @protected
     * @param {Error} err - 错误对象
     */
    _emitError(err) {
        this.errors.push(err);
        this.errorTime = performance.now();
        if (this.errors.length <= this.retryCount) {
            // 设置为等待状态，等待调度
            this.#setState(Task.STATE.WAITING);
            return;
        }
        return this.emit("error", err);
    }

    #setState(state) {
        assert(_.isSymbol(state), "state must be Symbol");
        this.state = state;
    }

    canStart() {
        if (!this.isWaiting())
            return false;
        if (this.errors.length > this.retryCount)
            return false;
        if (performance.now() < this.errorTime + this.retryDelay)
            return false;
        return true;
    }

    canRemove() {
        if (this.isCompleted())
            return true;
        if (this.errors.length > this.retryCount)
            return true;
        return false;
    }

    isWaiting() {
        return this.state == Task.STATE.WAITING;
    }

    isExecuting() {
        return this.state == Task.STATE.EXECUTING;
    }

    isCompleted() {
        return this.state == Task.STATE.COMPLETED;
    }

}