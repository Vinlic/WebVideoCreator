import assert from "assert";
import genericPool, { Pool as _Pool } from "generic-pool";
import _ from "lodash";

import Browser from "./Browser.js";

export default class Pool {

    /** @type {_Pool} */
    #browserPool;
    browserOptions = {};
    #checkMap = {};

    constructor(options) {
        assert(_.isObject(options), "Pool options must provided");
        const { numBrowserMax, numBrowserMin, browserOptions = {} } = options;
        assert(_.isFinite(numBrowserMax), "Pool options.numBrowserMax must be number");
        assert(_.isFinite(numBrowserMin), "Pool options.numBrowserMin must be number");
        assert(_.isObject(browserOptions), "Pool options.browserOptions must be object");
        this.browserOptions = browserOptions;
        this.#browserPool = genericPool.createPool({
            create: this.#createBrowser.bind(this),
            destroy: async target => target.close(),
            validate: target => target.isReady()
        }, {
            max: numBrowserMax,
            min: numBrowserMin,
            autostart: false
        });
        this.#browserPool.on('factoryCreateError', (error) => {
            this.#browserPool._waitingClientsQueue.dequeue().reject(error);
        });
        this.#checker();
    }
    
    async warmup() {
        this.#browserPool.start();
        await this.#browserPool.ready();
    }

    async acquirePage() {
        const browser = await this.acquireBrowser();
        const page = await browser.acquirePage();
        if(!browser.isBusy())
            browser.release();
        else if(!this.#checkMap[browser.id]) {
            this.#checkMap[browser.id] = () => {
                if(!browser.isBusy()) {
                    browser.release();
                    return true;
                }
                return false;
            };
        }
        return page;
    }

    /**
     * 
     * @returns {Browser}
     */
    async acquireBrowser() {
        return await this.#browserPool.acquire();
    }

    async #createBrowser() {
        const browser = new Browser(this, this.browserOptions);
        await browser.init();
        return browser;
    }

    async releaseBrowser(target) {
        await this.#browserPool.release(target);
    }

    async closeBrowser(target) {
        if(this.#checkMap[id])
            delete this.#checkMap[id];
        await this.#browserPool.destroy(target);
    }

    isBusy() {
        return this.#browserPool.borrowed >= this.#browserPool.max;
    }

    #checker() {
        (async () => {
            for(let id in this.#checkMap) {
                if(this.#checkMap[id]())
                    delete this.#checkMap[id];
            }
        })()
            .then(() => setTimeout(this.#checker.bind(this), 5000))
            .catch(err => console.error(err));
    }

}