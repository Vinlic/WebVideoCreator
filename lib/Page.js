import assert from "assert";
import { Page as _Page, CDPSession } from "puppeteer-core";
import _ from "lodash";

import Browser from "./Browser.js";

let pageIndex = 1;

export default class Page {

    static STATE = {
        UNINITIALIZED: Symbol("UNINITIALIZED"),
        READY: Symbol("READY"),
        WORKING: Symbol("WORKING"),
        UNAVAILABLED: Symbol("UNAVAILABLED"),
        CLOSED: Symbol("CLOSED")
    };

    id = `Page@${pageIndex++}`;
    /** @type {Page.STATE} */
    state = Page.STATE.UNINITIALIZED;
    /** @type {Browser} */
    parent = null;
    /** @type {_Page} */
    target = null;
    /** @type {CDPSession} */
    #cdpSession = null;
    #firstPage = false;

    constructor(parent, options) {
        assert(parent instanceof Browser, "Page parent must be Browser");
        this.parent = parent;
        assert(_.isObject(options), "Page options must provided");
        const { firstPage = false } = options;
        this.#firstPage = firstPage;
        assert(_.isBoolean(firstPage), "Page options.firstPage must be boolean");
    }

    async init() {
        if(this.#firstPage)
            this.target = (await this.parent.target.pages())[0];
        else
            this.target = await this.parent.target.newPage();
        await this.#startCDPSession();
        this.#setState(Page.STATE.READY);
    }

    async goto(url) {
        await this.target.goto(url);
        // await this.target.waitForNavigation();
    }

    async #startCDPSession() {
        this.#cdpSession && await this.#endCDPSession();
        this.#cdpSession = await this.target.createCDPSession();  //创建会话
        this.#cdpSession.on("Page.screencastFrame", async f => {
            console.log(f);
            await this.#cdpSession.send("Page.screencastFrameAck", { sessionId: f.sessionId });
        });
        this.#cdpSession.send("Page.startScreencast");
    }

    async #endCDPSession() {
        if (!this.#cdpSession) return;
        await new Promise(resolve => {
            this.#cdpSession.detach()
                .catch(err => logger.error("process detach CDPSession error:", err))
                .finally(() => {
                    this.#cdpSession.removeAllListeners();
                    this.#cdpSession = null;
                    resolve();
                });
        });
    }

    async release() {
        await this.parent.releasePage(this);
        this.#setState(Page.STATE.READY);
    }

    async close() {
        if(this.isClosed())
            return;
        this.#setState(Page.STATE.CLOSED);
        await this.parent.closePage(this);
        if(!this.target || this.target.isClosed())
            return;
        this.target.close();
        this.target = null;
    }

    #setState(state) {
        assert(_.isSymbol(state), "state must be Symbol");
        this.state = state;
    }

    isUninitialized() {
        return this.state == Page.STATE.UNINITIALIZED;
    }

    isReady() {
        return this.state == Page.STATE.READY;
    }

    isWorking() {
        return this.state == Page.STATE.WORKING;
    }

    isUnavailabled() {
        return this.state == Page.STATE.UNAVAILABLED;
    }

    isClosed() {
        return this.state == Page.STATE.CLOSED;
    }

}