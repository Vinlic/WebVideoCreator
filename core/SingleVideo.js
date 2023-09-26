import assert from "assert";
import _ from "lodash";
import AsyncLock from "async-lock";

import globalConfig from "../lib/global-config.js";
import BaseVideo from "./BaseVideo.js";
import Synthesizer from "./Synthesizer.js";
import logger from "../lib/logger.js";
import util from "../lib/util.js";

export default class SingleVideo extends BaseVideo {

    url;
    outputPath;
    width;
    height;
    fps;
    duration;
    consoleLog;
    #asyncLock = new AsyncLock();

    /**
     * 构造函数
     * 
     * @param {Object} options - 单幕视频选项
     * @param {string} options.outputPath - 输出路径
     * @param {string} options.url - 页面URL
     * @param {number} options.width - 视频宽度
     * @param {number} options.height - 视频高度
     * @param {number} options.duration - 视频时长
     * @param {number} [options.fps=30] - 视频帧率
     * @param {boolean} [options.consoleLog=false] - 是否开启控制台日志输出
     */
    constructor(options = {}) {
        super();
        assert(_.isObject(options), "options must be Object");
        const { url, outputPath, width, height, duration, fps, consoleLog } = options;
        assert(util.isURL(url), `url ${url} is not valid URL`);
        assert(_.isString(outputPath), "outputPath must be string");
        assert(_.isFinite(width), "width must be number");
        assert(_.isFinite(height), "height must be number");
        assert(_.isFinite(duration), "duration must be number");
        assert(_.isUndefined(fps) || _.isFinite(fps), "fps must be number");
        assert(_.isUndefined(consoleLog) || _.isBoolean(consoleLog), "consoleLog must be boolean");
        this.url = url;
        this.outputPath = outputPath;
        this.width = width;
        this.height = height;
        this.duration = duration;
        this.fps = _.defaultTo(fps, 30);
        this.consoleLog = _.defaultTo(consoleLog, false);
    }

    /**
     * 启动合成
     */
    start() {
        this.#synthesize()
            .catch(err => logger.error(err));
    }

    /**
     * 合成处理
     */
    async #synthesize() {
        const page = await this._acquirePage();
        try {
            const { url, outputPath, width, height, fps, duration } = this;
            const { videoEncoder, audioEncoder } = globalConfig;
            if (this.consoleLog) {
                // 监听页面打印到console的正常日志
                page.on("consoleLog", message => logger.log(message));
                // 监听页面打印到console的错误日志
                page.on("consoleError", err => logger.error(err));
            }
            // 监听页面实例发生的某些内部错误
            page.on("error", err => this._emitError("Page error:\n" + err.stack));
            // 监听页面是否崩溃，当内存不足或过载时可能会崩溃
            page.on("crashed", err => this._emitError("Page crashed:\n" + err.stack));
            // 设置视窗宽高
            await page.setViewport({
                width,
                height
            });
            const synthesizer = new Synthesizer({
                outputPath,
                width,
                height,
                fps,
                duration,
                videoEncoder,
                audioEncoder
            });
            // 监听合成进度
            synthesizer.on("progress", (progress, synthesizedFrameCount, totalFrameCount) => this.emit("progress", progress, synthesizedFrameCount, totalFrameCount));
            // 监听合成器错误
            synthesizer.on("error", err => this._emitError("Synthesize error:\n" + err.stack));
            page.on("audioAdd", options => synthesizer.addAudio(options));
            page.on("audioUpdate", (audioId, options) => synthesizer.updateAudio(audioId, options))
            // 跳转到您希望渲染的页面，您可以考虑创建一个本地的Web服务器提供页面以提升加载速度和安全性
            await page.goto(url);
            // 等待字体加载完成
            await page.waitForFontsLoaded();
            // 启动合成
            synthesizer.start();
            // 合成完成promise
            const completedPromise = new Promise(resolve => synthesizer.once("completed", resolve));
            // 监听已渲染的帧输入到合成器
            page.on("frame", buffer => synthesizer.input(buffer));
            // 启动捕获
            await page.startScreencast({
                fps,
                duration
            });
            // 监听并等待录制完成
            await new Promise(resolve => page.once("screencastCompleted", resolve));
            // 停止录制
            await page.stopScreencast();
            // 释放页面资源
            await page.release();
            // 告知合成器结束输入
            synthesizer.endInput();
            // 等待合成完成
            await completedPromise;
        }
        catch (err) {
            await page.release();
            this._emitError(err);
        }
    }

}