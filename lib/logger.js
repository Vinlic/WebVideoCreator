import util from "util";
import "colors";
import { format as dateFormat } from "date-fns";

import globalConfig from "./global-config.js";

/**
 * 日志文本格式化
 */
class LogText {

    /** @type {string} - 日志级别 */
    level;
    /** @type {string} - 日志文本 */
    text;
    /** @type {string} - 日志来源 */
    source;
    /** @type {Date} - 日志产生时间点 */
    time = new Date();

    constructor(level, ...params) {
        this.level = level;
        // 使用util.format将参数格式化为文本
        this.text = util.format.apply(null, params);
        // 获取调用栈顶信息
        this.source = this.#getStackTopCodeInfo();
    }

    /**
     * 获取调用栈顶部信息
     * 
     * @returns {Object} - 调用信息对象
     */
    #getStackTopCodeInfo() {
        const unknownInfo = { name: "unknown", codeLine: 0, codeColumn: 0 };
        const stackArray = new Error().stack.split("\n");
        const text = stackArray[4];
        if (!text)
            return unknownInfo;
        const match = text.match(/at (.+) \((.+)\)/) || text.match(/at (.+)/);
        if (!match || !util.isString(match[2] || match[1]))
            return unknownInfo;
        const temp = match[2] || match[1];
        const _match = temp.match(/([a-zA-Z0-9_\-\.]+)\:(\d+)\:(\d+)$/);
        if (!_match)
            return unknownInfo;
        const [, scriptPath, codeLine, codeColumn] = _match;
        return {
            name: scriptPath ? scriptPath.replace(/.js$/, "") : "unknown",
            path: scriptPath || null,
            codeLine: parseInt(codeLine || 0),
            codeColumn: parseInt(codeColumn || 0)
        };
    }

    /**
     * 导出为日志内容
     * 
     * @returns {string} - 日志内容
     */
    toString() {
        return `[${dateFormat(this.time, "yyyy-MM-dd HH:mm:ss.SSS")}][${this.level}][${this.source.name}<${this.source.codeLine},${this.source.codeColumn}>] ${this.text}`;
    }

}

export default {

    /**
     * 打印成功日志
     * 
     * @param  {...any} params - 参数
     */
    success(...params) {
        const content = new LogText("success", ...params).toString();
        console.info(content["green"]);
    },

    /**
     * 打印信息日志
     * 
     * @param  {...any} params - 参数
     */
    info(...params) {
        const content = new LogText("info", ...params).toString();
        console.info(content["brightCyan"]);
    },

    /**
     * 打印普通日志
     * 
     * @param  {...any} params - 参数
     */
    log(...params) {
        const content = new LogText("log", ...params).toString();
        console.info(content["white"]);
    },

    /**
     * 打印内部调试日志
     * 
     * @param  {...any} params - 参数
     */
    _debug(...params) {
        const content = new LogText("debug", ...params).toString();
        console.info(content["white"]);
    },

    /**
     * 打印调试日志
     * 
     * @param  {...any} params - 参数
     */
    debug(...params) {
        if (!globalConfig.debug)
            return;
        const content = new LogText("debug", ...params).toString();
        console.info(content["white"]);
    },

    /**
     * 打印警告日志
     * 
     * @param  {...any} params - 参数
     */
    warn(...params) {
        const content = new LogText("warn", ...params).toString();
        console.info(content["brightYellow"]);
    },

    /**
     * 打印错误日志
     * 
     * @param  {...any} params - 参数
     */
    error(...params) {
        const content = new LogText("error", ...params).toString();
        console.info(content["brightRed"]);
    }

};