import assert from "assert";
import _ from "lodash";
import EventEmitter from "eventemitter3";

import Page from "./Page.js";
import logger from "../lib/logger.js";

export default class BaseVideo extends EventEmitter {

    /** @type {Function} - 页面获取函数 */
    #pageAcquireFn = null;

    /**
     * 注册页面获取函数
     * 
     * @param {Function} fn 
     */
    onPageAcquire(fn) {
        assert(_.isFunction(fn), "Page acquire function must be Function");
        this.#pageAcquireFn = fn;
    }

    /**
     * 获取渲染页面
     * 
     * @protected
     * @returns {Page} - 页面对象
     */
    async _acquirePage() {
        assert(_.isFunction(this.#pageAcquireFn), "Page acquire function must be Function");
        return await this.#pageAcquireFn();
    }

    _emitProgress() {

    }

    /**
     * 发送错误事件
     * 
     * @param {string|Error} err - 错误对象
     */
    _emitError(err) {
        if(_.isString(err))
            err = new Error(err);
        if(this.eventNames().includes("error"))
            this.emit("error", err);
        else
            logger.error(err);
    }

}