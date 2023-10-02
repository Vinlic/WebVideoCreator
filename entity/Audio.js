import assert from "assert"
import path from "path";
import fs from "fs-extra";
import _ from "lodash";
import AsyncLock from "async-lock";

import util from "../lib/util.js";

const downloadLock = new AsyncLock();

/**
 * 音频
 */
export default class Audio {

    /** @type {number} - 音频ID */
    id;
    /** @type {string} - 音频路径 */
    path;
    /** @type {string} - 音频URL */
    url;
    /** @type {number} - 起始时间点（毫秒） */
    startTime;
    /** @type {number} - 结束时间点（毫秒） */
    endTime;
    /** @type {number} - 时长 */
    duration;
    /** @type {boolean|number} - 是否循环播放 */
    loop;
    /** @type {number} - 音量（0-100） */
    volume;
    /** @type {number} - 裁剪起始时间点（毫秒） */
    seekStart;
    /** @type {number} - 裁剪结束实际点（毫秒） */
    seekEnd;
    /** @type {number} - 淡入时长（毫秒） */
    fadeInDuration;
    /** @type {number} - 淡出时长（毫秒 */
    fadeOutDuration;
    /** @type {number} - 重试拉取次数 */
    retryFetchs;
    /** @type {boolean} - 是否忽略本地缓存 */
    ignoreCache;
    /** @type {string} - 临时路径 */
    tmpDirPath = path.resolve("tmp/preprocessor/");
    /** @type {Promise} - 加载承诺 */
    #loadPromise;

    /**
     * 构造函数
     * 
     * @param {Object} options - 音频选项
     * @param {number} [options.id] - 音频ID
     * @param {string} [options.path] - 音频路径
     * @param {string} [options.url] - 音频URL
     * @param {number} [options.startTime=0] - 起始时间点（毫秒）
     * @param {number} [options.endTime] - 结束时间点（毫秒）
     * @param {boolean} [options.loop=false] - 是否循环播放
     * @param {number} [options.volume=100] - 音量（0-100）
     * @param {number} [options.seekStart=0] - 裁剪起始时间点（毫秒）
     * @param {number} [options.seekEnd] - 裁剪结束实际点（毫秒）
     * @param {number} [options.fadeInDuration] - 淡入时长（毫秒）
     * @param {number} [options.fadeOutDuration] - 淡出时长（毫秒）
     * @param {number} [options.retryFetchs=2] - 重试拉取次数
     * @param {boolean} [options.ignoreCache=false] - 是否忽略本地缓存
     */
    constructor(options) {
        assert(_.isObject(options), "addAudio options must be object");
        const { id, path: _path, url, startTime, endTime, loop, volume, seekStart, seekEnd,
            fadeInDuration, fadeOutDuration, retryFetchs, ignoreCache } = options;
        assert(_.isUndefined(id) || _.isFinite(id), "Audio id must be number");
        assert(_.isString(_path) || _.isString(url), "Audio path or url must be string");
        assert(_.isUndefined(startTime) || _.isFinite(startTime), "Audio startTime must be number");
        assert(_.isUndefined(endTime) || _.isFinite(endTime), "Audio endTime must be number");
        assert(_.isUndefined(loop) || _.isBoolean(loop), "Audio loop must be boolean");
        assert(_.isUndefined(volume) || _.isFinite(volume), "Audio volume must be number");
        assert(_.isUndefined(seekStart) || _.isFinite(seekStart), "Audio seekStart must be number");
        assert(_.isUndefined(seekEnd) || _.isFinite(seekEnd), "Audio seekEnd must be number");
        assert(_.isUndefined(fadeInDuration) || _.isFinite(fadeInDuration), "Audio fadeInDuration must be number");
        assert(_.isUndefined(fadeOutDuration) || _.isFinite(fadeOutDuration), "Audio fadeOutDuration must be number");
        assert(_.isUndefined(retryFetchs) || _.isFinite(retryFetchs), "Audio retryFetchs must be number");
        assert(_.isUndefined(ignoreCache) || _.isBoolean(ignoreCache), "Audio fadeOutDuration must be boolean");
        this.id = id;
        this.path = _.isString(_path) ? path.resolve(_path) : _path;
        this.url = url;
        this.startTime = _.defaultTo(startTime, 0);
        this.endTime = endTime;
        this.loop = _.defaultTo(loop, false);
        this.volume = _.defaultTo(volume, 100);
        this.seekStart = _.defaultTo(seekStart, 0);
        this.seekEnd = seekEnd;
        this.fadeInDuration = fadeInDuration;
        this.fadeOutDuration = fadeOutDuration;
        this.retryFetchs = _.defaultTo(retryFetchs, 2);
        this.ignoreCache = _.defaultTo(ignoreCache, false);
    }

    /**
     * 资源加载
     */
    async load() {
        if (this.#loadPromise)
            return this.#loadPromise;
        this.#loadPromise = (async () => {
            if (this.path) {
                if (!await fs.pathExists(this.path))
                    throw new Error(`Audio source ${this.path} not exists`);
                if (!(await fs.stat(this.path)).isFile())
                    throw new Error(`Audio source ${this.path} must be file`);
            }
            else if (this.url)
                this.path = await this.#downloadFile(this.url);
            this.duration = await util.getMediaDuration(this.path);
            if (this.endTime > 0 && this.startTime > this.endTime)
                throw new Error(`Audio startTime (${this.startTime}) > endTime (${this.endTime})`);
            if (this.seekEnd && this.seekStart > this.seekEnd)
                throw new Error(`Audio seekStart (${this.seekStart}) > seekEnd (${this.seekEnd})`);
        })();
        return this.#loadPromise;
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
                mimesLimit: [
                    /^audio\//,
                    /^application\/octet-stream/
                ],
                retryFetchs: this.retryFetchs
            });
            await fs.move(`${filePath}.tmp`, filePath);
        });
        return filePath;
    }

}