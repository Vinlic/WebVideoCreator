import puppeteer from "puppeteer-core";

import util from "./util.js";

export default class Previewer {

    /** @type {number} - 预览帧率 */
    fps;

    /**
     * 构造函数
     * 
     * @param {Object} options - 预览器选项
     */
    constructor(options) {

    }

    async launch() {
        await puppeteer.launch({
            headless: false,
            channel: "chrome",
            userDataDir: util.rootPathJoin("tmp/previewer"),
            args: [
                `--app=http://www.google.com`,
                "--disable-info-bars"
            ]
        });
    }

    input() {

    }

}