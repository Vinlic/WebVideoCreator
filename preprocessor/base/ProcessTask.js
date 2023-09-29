import Task from "./Task.js";
import logger from "../../lib/logger.js";

export default class ProcessTask extends Task {

    /** @type {Task.TYPE} - 任务类型 */
    type = Task.TYPE.PROCESS;

    /**
     * 启动任务
     */
    start() {
        super.start();
        this.process()
            .then(result => this._emitCompleted(result))
            .catch(err => this._emitError(err));
    }

    /**
     * 处理
     */
    async process() {
        logger.warn("Process task nothing to do...");
        return null;
    }

}