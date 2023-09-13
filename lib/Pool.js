import assert from "assert";
import AsyncLock from "async-lock";
import genericPool, { Pool as _Pool } from "generic-pool";
import _ from "lodash";

import Browser from "./Browser.js";
import Page from "./Page.js";

const asyncLock = new AsyncLock();

/**
 * 资源池
 */
export default class Pool {

    /** @type {_Pool} */
    #browserPool;
    numBrowserMax = 0;
    numBrowserMin = 0;
    browserOptions = {};
    #checkMap = {};

    /**
     * 构造函数
     * 
     * @param {Object} options - 资源池选项
     * @param {number} options.numBrowserMax - 浏览器资源最大数量
     * @param {number} options.numBrowserMin - 浏览器资源最小数量
     * @param {object} options.browserOptions - 浏览器选项
     */
    constructor(options) {
        assert(_.isObject(options), "Pool options must provided");
        const { numBrowserMax, numBrowserMin, browserOptions = {} } = options;
        assert(_.isFinite(numBrowserMax), "Pool options.numBrowserMax must be number");
        assert(_.isFinite(numBrowserMin), "Pool options.numBrowserMin must be number");
        assert(_.isObject(browserOptions), "Pool options.browserOptions must be object");
        this.numBrowserMax = numBrowserMax;
        this.numBrowserMin = numBrowserMin;
        this.browserOptions = browserOptions;
        this.#createBrowserPool();
        this.#checker();
    }

    /**
     * 预热浏览器资源池
     */
    async warmup() {
        this.#browserPool.start();
        await this.#browserPool.ready();
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
            if(!client) return console.error(error);
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
        if (this.#checkMap[id])
            delete this.#checkMap[id];
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
            .catch(err => console.error(err));
    }

}