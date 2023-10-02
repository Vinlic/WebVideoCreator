import assert from "assert";
import _ from "lodash";
import AsyncLock from "async-lock";

import DownloadTask from "../base/DownloadTask.js";
import util from "../../lib/util.js";

const downloadLock = new AsyncLock();

export default class VideoDownloadTask extends DownloadTask {

    /** @type {DownloadTask.TYPE} - 任务类型 */
    type = DownloadTask.TYPE.DOWNLOAD;
    /** @type {string} - 资源URL */
    url;
    /** @type {string} - 蒙版资源URL */
    maskUrl;

    /**
     * 构造函数
     * 
     * @param {Object} options - 任务选项
     * @param {string} options.url - 资源URL
     * @param {string} [options.maskUrl] - 蒙版资源URL
     * @param {number} [options.retryFetchs=2] - 重试次数
     * @param {number} [options.retryDelay=1000] - 重试延迟
     */
    constructor(options) {
        super(options);
        const { url, maskUrl, retryFetchs } = options;
        assert(util.isURL(url), "url is invalid");
        assert(_.isUndefined(maskUrl) || _.isString(maskUrl), "maskUrl is invalid");
        assert(_.isUndefined(retryFetchs) || _.isFinite(retryFetchs), "retryFetchs must be number");
        this.url = url;
        this.maskUrl = maskUrl;
        this.retryCount = retryFetchs || 2;
    }

    /**
     * 启动任务
     */
    start() {
        if (!this.maskUrl)
            super.start();
        else {
            super.start(true);
            const mimesLimit = [
                /^video\//,
                /^application\/octet-stream/
            ];
            Promise.all([
                this._downloadFile(this.url, mimesLimit),
                this._downloadFile(this.maskUrl, mimesLimit)
            ])
                .then(([filePath, maskFilePath]) => this._emitCompleted({ filePath, maskFilePath }))
                .catch(err => this._emitError(err));
        }
    }

}