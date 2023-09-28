import assert from "assert";
import AsyncLock from "async-lock";
import genericPool, { Pool as _Pool } from "generic-pool";
import VideoPreprocessor from "../preprocessor/video/VideoPreprocessor.js";
import _ from "lodash";

import Browser from "./Browser.js";
import Page from "./Page.js";
import logger from "../lib/logger.js";

// 异步锁
const asyncLock = new AsyncLock();

/**
 * 资源池
 */
export default class ResourcePool {

    /**
     * @typedef {Object} PageOptions
     * @property {number} [width] - 页面视窗宽度
     * @property {number} [height] - 页面视窗高度
     * @property {string} [userAgent] - 用户UA
     * @property {number} [beginFrameTimeout=5000] - BeginFrame超时时间（毫秒）
     * @property {string} [frameFormat="jpeg"] - 帧图格式
     * @property {number} [frameQuality=80] - 帧图质量（0-100）
     * @property {string[]} [args] - 浏览器启动参数
     */

    /**
     * @typedef {Object} BrowserOptions
     * @property {number} numPageMax - 页面资源最大数量
     * @property {number} numPageMin - 页面资源最小数量
     * @property {string} [executablePath] - 浏览器入口文件路径
     * @property {boolean} [useGPU=true] - 是否使用GPU加速渲染
     * @property {boolean} [useAngle=true] - 3D渲染后端是否使用Angle，建议开启
     * @property {boolean} [disableDevShm=false] - 是否禁用共享内存，当/dev/shm较小时建议开启此选项
     * @property {string[]} [args] - 浏览器启动参数
     * @property {boolean} [debug=false] - 浏览器日志是否输出到控制台
     * @property {PageOptions} [pageOptions] - 页面选项
     */

    /**
     * @typedef {Object} VideoPreprocessorOptions
     * @property {number} [parallelDownloads=10] - 并行下载数量
     * @property {number} [parallelProcess=10] - 并行处理数量
     * @property {string} [videoEncoder="libx264"] - 视频编码器（必须为H264编码器）
     */

    /** @type {_Pool} - 浏览器资源池 */
    #browserPool;
    /** @type {VideoPreprocessor} - 视频预处理器 */
    #videoPreprocessor;
    /** @type {number} - 浏览器资源最大数量 */
    numBrowserMax;
    /** @type {number} - 浏览器资源最小数量 */
    numBrowserMin;
    /** @type {BrowserOptions} - 浏览器选项 */
    browserOptions = {};
    /** @type {VideoPreprocessorOptions} - 浏览器选项 */
    videoPreprocessorOptions = {};
    #warmupped = false;
    #checkMap = {};

    /**
     * 构造函数
     * 
     * @param {Object} options - 资源池选项
     * @param {number} options.numBrowserMax - 浏览器资源最大数量
     * @param {number} options.numBrowserMin - 浏览器资源最小数量
     * @param {BrowserOptions} [options.browserOptions={}] - 浏览器选项
     * @param {VideoPreprocessorOptions} [options.videoPreprocessorOptions={}] - 视频预处理器选项
     */
    constructor(options) {
        assert(_.isObject(options), "ResourcePool options must provided");
        const { numBrowserMax, numBrowserMin, browserOptions, videoPreprocessorOptions } = options;
        assert(_.isFinite(numBrowserMax), "ResourcePool options.numBrowserMax must be number");
        assert(_.isFinite(numBrowserMin), "ResourcePool options.numBrowserMin must be number");
        assert(_.isUndefined(browserOptions) || _.isObject(browserOptions), "ResourcePool options.browserOptions must be object");
        assert(_.isUndefined(videoPreprocessorOptions) || _.isObject(videoPreprocessorOptions), "ResourcePool options.browserOptions must be object");
        this.numBrowserMax = numBrowserMax;
        this.numBrowserMin = numBrowserMin;
        this.browserOptions = _.defaultTo(browserOptions, {});
        this.videoPreprocessorOptions = _.defaultTo(videoPreprocessorOptions, {});
        this.#videoPreprocessor = new VideoPreprocessor(this.videoPreprocessorOptions);
        this.#createBrowserPool();
        this.#checker();
    }

    /**
     * 预热浏览器资源池
     */
    async warmup() {
        if(this.#warmupped) return;
        await asyncLock.acquire("warmup", async () => {
            this.#browserPool.start();
            await this.#browserPool.ready();
            this.#warmupped = true;
        });
    }

    /**
     * 创建浏览器资源池
     */
    #createBrowserPool() {
        this.#browserPool = genericPool.createPool({
            create: this.#createBrowser.bind(this),
            destroy: async target => target.close(),
            validate: target => target.isReady()
        }, {
            max: this.numBrowserMax,
            min: this.numBrowserMin,
            autostart: false
        });
        this.#browserPool.on('factoryCreateError', (error) => {
            const client = this.#browserPool._waitingClientsQueue.dequeue();
            if(!client) return logger.error(error);
            client.reject(error);
        });
    }

    /**
     * 获取可用页面资源
     * 
     * @returns {Page}
     */
    async acquirePage() {
        // 使用异步锁解决重入
        return await asyncLock.acquire("acquirePage", async () => {
            // 获取可用的浏览器资源
            const browser = await this.acquireBrowser();
            // 从浏览器获取可用的页面资源
            const page = await browser.acquirePage();
            // 如果浏览器页面池未饱和则释放浏览器资源供下一次获取
            if (!browser.isBusy())
                await browser.release();
            // 如果已饱和加入检查列表等待未饱和时释放浏览器资源
            else if (!this.#checkMap[browser.id]) {
                this.#checkMap[browser.id] = () => {
                    if (!browser.isBusy()) {
                        browser.release();
                        return true;
                    }
                    return false;
                };
            }
            // 返回可用页面资源
            return page;
        });
    }

    /**
     * 获取可用浏览器资源
     * 
     * @returns {Browser}
     */
    async acquireBrowser() {
        !this.#warmupped && await this.warmup();
        return await this.#browserPool.acquire();
    }

    /**
     * 创建浏览器资源
     * 
     * @returns {Browser} - 浏览器资源
     */
    async #createBrowser() {
        const browser = new Browser(this, this.browserOptions);
        await browser.init();
        return browser;
    }

    /**
     * 释放浏览器资源
     * 
     * @param {Browser} browser - 浏览器资源
     */
    async releaseBrowser(browser) {
        await this.#browserPool.release(browser);
    }

    /**
     * 销毁浏览器资源
     * 
     * @param {Browser} browser - 浏览器资源
     */
    async destoryBrowser(browser) {
        if (this.#checkMap[browser.id])
            delete this.#checkMap[browser.id];
        await this.#browserPool.destroy(browser);
    }

    /**
     * 判断浏览器资源池是否饱和
     * 
     * @returns {boolean} 浏览器池是否饱和
     */
    isBusy() {
        return this.#browserPool.borrowed >= this.#browserPool.max;
    }

    /**
     * 检查器
     */
    #checker() {
        (async () => {
            for (let id in this.#checkMap) {
                if (this.#checkMap[id]())
                    delete this.#checkMap[id];
            }
        })()
            .then(() => setTimeout(this.#checker.bind(this), 5000))
            .catch(err => logger.error(err));
    }

    /**
     * 获取视频预处理器
     */
    get videoPreprocessor() {
        return this.#videoPreprocessor;
    }

}