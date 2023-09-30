import path from "path";
import assert from "assert";
import fs from "fs-extra";
import _ from "lodash";
import AsyncLock from "async-lock";

import Task from "./Task.js";
import util from "../../lib/util.js";

const downloadLock = new AsyncLock();

export default class DownloadTask extends Task {

    /** @type {Task.TYPE} - 任务类型 */
    type = Task.TYPE.DOWNLOAD;
    /** @type {string} - 资源URL */
    url;

    /**
     * 构造函数
     * 
     * @param {Object} options - 任务选项
     * @param {string} options.url - 资源URL
     * @param {number} [options.retryFetchs=2] - 重试次数
     * @param {number} [options.retryDelay=1000] - 重试延迟
     */
    constructor(options) {
        super(options);
        const { url, retryFetchs } = options;
        assert(util.isURL(url), "url is invalid");
        assert(_.isUndefined(retryFetchs) || _.isFinite(retryFetchs), "retryFetchs must be number");
        this.url = url;
        this.retryCount = retryFetchs || 2;
    }

    /**
     * 启动任务
     */
    start() {
        super.start();
        this.#downloadFile(this.url)
            .then(result => this._emitCompleted(result))
            .catch(err => this._emitError(err));
    }

    /**
     * 下载文件
     *
     * @param {string} url 资源URL
     */
    async #downloadFile(url) {
        const filePath = path.join(this.tmpDirPath, util.urlToPath(url));
        await downloadLock.acquire(util.crc32(url), async () => {
            if (!this.ignoreCache && await fs.pathExists(filePath)) return filePath;
            await fs.ensureDir(path.dirname(filePath), { recursive: true });
            const writeStream = fs.createWriteStream(`${filePath}.tmp`);
            await util.download(url, writeStream, {
                onProgress: v => this._updateProgress(v),
                mimesLimit: [
                    /^video\//,
                    /^application\/octet-stream/
                ]
            });
            await fs.move(`${filePath}.tmp`, filePath);
        });
        return filePath;
    }

}