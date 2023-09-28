import util from "util";
import "colors";
import { format as dateFormat } from "date-fns";

import globalConfig from "./global-config.js";

class LogText {

    level;  //日志级别
    text;  //日志文本
    source;  //日志来源
    time = new Date();  //日志发生时间

    constructor(level, ...params) {
        this.level = level;
        this.text = util.format.apply(null, params);
        this.source = this.#getStackTopCodeInfo();
    }

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

    toString() {
        return `[${dateFormat(this.time, "yyyy-MM-dd HH:mm:ss.SSS")}][${this.level}][${this.source.name}<${this.source.codeLine},${this.source.codeColumn}>] ${this.text}`;
    }

}

export default {

    success(...params) {
        const content = new LogText("success", ...params).toString();
        console.info(content["green"]);
    },

    info(...params) {
        const content = new LogText("info", ...params).toString();
        console.info(content["brightCyan"]);
    },

    log(...params) {
        const content = new LogText("log", ...params).toString();
        console.info(content["white"]);
    },

    _debug(...params) {
        const content = new LogText("debug", ...params).toString();
        console.info(content["white"]);
    },

    debug(...params) {
        if (!globalConfig.debug)
            return;
        const content = new LogText("debug", ...params).toString();
        console.info(content["white"]);
    },

    warn(...params) {
        const content = new LogText("warn", ...params).toString();
        console.info(content["brightYellow"]);
    },

    error(...params) {
        const content = new LogText("error", ...params).toString();
        console.info(content["brightRed"]);
    }

};