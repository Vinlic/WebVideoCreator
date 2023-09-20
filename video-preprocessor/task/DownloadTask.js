import path from "path";
import assert from "assert";
import fs from "fs-extra";
import _ from "lodash";
import AsyncLock from "async-lock";

import Task from "./Task.js";
import util from "../../lib/util.js";

const downloadLock = new AsyncLock();

export default class DownloadTask extends Task {

    /** @type {string} - 资源URL */
    url;

    constructor(options) {
        super(options);
        const { url } = options;
        assert(util.isURL(url), "url is invalid");
        this.url = url;
    }

    start() {
        super.start();
        this.#downloadFile(this.url)
            .then(() => this._emitCompleted())
            .catch(err => this._emitError(err));
    }

    /**
     * 下载视频文件
     *
     * @param {string} url 视频来源URL
     */
    async #downloadFile(url) {
        const filePath = path.join(this._tmpDirPath, this.#urlToPath(url));
        await downloadLock.acquire(util.crc32(url), async () => {
            if (await fs.pathExists(filePath)) return filePath;
            await fs.ensureDir(path.dirname(filePath), { recursive: true });
            const writeStream = fs.createWriteStream(`${filePath}.tmp`);
            await util.download(url, writeStream, {
                onProgress: v => this._updateProgress(v)
            });
            await fs.move(`${filePath}.tmp`, filePath);
        });
        return filePath;
    }

    /**
     * URL转本地路径
     * 
     * @param {string} value - URL
     * @returns {string} - 路径
     */
    #urlToPath(value) {
        return value
            .replace(/(\d+)\.(\d+)\.(\d+)\.(\d+):(\d+)/g, "$1_$2_$3_$4_$5")
            .replace(/^(http|https):\/\//, "")
            .replace(/\?.+/, "");
    }

}