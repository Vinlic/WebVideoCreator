import Task from "./Task.js";

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

    async process() {
        console.warn("Process task nothing to do...");
        return null;
    }

}