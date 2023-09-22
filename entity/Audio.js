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

    /** @type {string} - 音频路径 */
    path;
    /** @type {string} - 音频URL */
    url;
    /** @type {number} - 时间轴中音频的起始时间点（毫秒） */
    startTime;
    /** @type {number} - 时间轴中音频的结束时间点（毫秒） */
    endTime;
    /** @type {boolean|number} - 音频是否循环播放 */
    loop;
    /** @type {number} - 音频时长（毫秒） */
    duration;
    /** @type {number} - 音频音量（0-100） */
    volume;
    /** @type {number} - 音频时长裁剪起始时间点（毫秒） */
    seekStart;
    /** @type {number} - 音频时长裁剪结束实际点（毫秒） */
    seekEnd;
    /** @type {number} - 音频淡入时长（毫秒） */
    fadeInDuration;
    /** @type {number} - 音频淡出时长（毫秒 */
    fadeOutDuration;
    /** @type {Promise} - 加载承诺 */
    #loadPromise;
    /** @type {string} - 临时路径 */
    #tmpDirPath;

    /**
     * 构造函数
     * 
     * @param {Object} options - 音频选项
     * @param {string} [options.path] - 音频路径
     * @param {string} [options.url] - 音频URL
     * @param {number} [options.startTime] - 时间轴中音频的起始时间点（毫秒）
     * @param {number} [options.endTime] - 时间轴中音频的结束时间点（毫秒）
     * @param {boolean} [options.loop=false] - 音频是否循环播放
     * @param {number} [options.duration] - 音频时长（毫秒）
     * @param {number} [options.volume] - 音频音量（0-100）
     * @param {number} [options.seekStart] - 音频时长裁剪起始时间点（毫秒）
     * @param {number} [options.seekEnd] - 音频时长裁剪结束实际点（毫秒）
     * @param {number} [options.fadeInDuration] - 音频淡入时长（毫秒）
     * @param {number} [options.fadeOutDuration] - 音频淡出时长（毫秒
     */
    constructor(options) {
        assert(_.isObject(options), "addAudio options must be object");
        const { path, url, startTime, endTime, loop, duration, volume,
            seekStart, seekEnd, fadeInDuration, fadeOutDuration } = options;
        assert(_.isString(path) || _.isString(url), "Audio path or url must be string");
        assert(_.isNil(startTime) || _.isFinite(startTime), "Audio startTime must be number");
        assert(_.isNil(endTime) || _.isFinite(endTime), "Audio endTime must be number");
        assert(_.isNil(loop) || _.isBoolean(loop), "Audio loop must be boolean");
        assert(_.isNil(duration) || _.isFinite(duration), "Audio duration must be number");
        assert(_.isNil(volume) || _.isFinite(volume), "Audio volume must be number");
        assert(_.isNil(seekStart) || _.isFinite(seekStart), "Audio seekStart must be number");
        assert(_.isNil(seekEnd) || _.isFinite(seekEnd), "Audio seekEnd must be number");
        assert(_.isNil(fadeInDuration) || _.isFinite(fadeInDuration), "Audio fadeInDuration must be number");
        assert(_.isNil(fadeOutDuration) || _.isFinite(fadeOutDuration), "Audio fadeOutDuration must be number");
        this.path = path;
        this.url = url;
        this.startTime = _.defaultTo(startTime, 0);
        this.endTime = endTime;
        this.loop = _.defaultTo(loop, false);
        this.duration = _.defaultTo(duration, this.endTime ? (this.endTime - this.startTime) : undefined);
        this.volume = _.defaultTo(volume, 100);
        this.seekStart = seekStart;
        this.seekEnd = seekEnd;
        this.fadeInDuration = fadeInDuration;
        this.fadeOutDuration = fadeOutDuration;
        this.#tmpDirPath = util.rootPathJoin(`tmp/preprocessor/`);
    }

    /**
     * 资源初始化
     */
    async load() {
        if(this.#loadPromise)
            return this.#loadPromise;
        this.#loadPromise = (async () => {
            if (this.path) {
                if (!await fs.pathExists(this.path))
                    throw new Error(`Audio source ${this.path} not exists`);
                if (!(await fs.stat(this.path)).isFile())
                    throw new Error(`Audio source ${this.path} must be file`);
            }
            else if (this.url) {
                const { mime } = await util.checkRemoteResource(this.url);
                if (!/^audio\//.test(mime) || mime == "application/octet-stream")
                    throw new Error(`Resource ${this.url} content type ${mime} is not audio type`);
                this.path = await this.#downloadFile(this.url);
            }
            // 未设置时长时将获取音频时长
            if(!this.duration)
                this.duration = await util.getMediaDuration(this.path);
            if(this.endTime) {
                if(this.startTime > this.endTime)
                    throw new Error(`Audio startTime(${this.startTime}) > endTime(${this.endTime})`);
                if(this.endTime - this.startTime > this.duration)
                    throw new Error(`Audio endTime(${this.endTime}) - startTime(${this.startTime}) > duration(${this.duration})`);
            }
            if(this.seekEnd && (this.seekStart || 0) > this.seekEnd)
                throw new Error(`Audio seekStart(${this.seekStart}) > seekEnd(${this.seekEnd})`);
        })();
        return this.#loadPromise;
    }

    /**
     * 下载文件
     *
     * @param {string} url 资源URL
     */
    async #downloadFile(url) {
        const filePath = path.join(this.#tmpDirPath, util.urlToPath(url));
        await downloadLock.acquire(util.crc32(url), async () => {
            if (await fs.pathExists(filePath)) return filePath;
            await fs.ensureDir(path.dirname(filePath), { recursive: true });
            const writeStream = fs.createWriteStream(`${filePath}.tmp`);
            await util.download(url, writeStream);
            await fs.move(`${filePath}.tmp`, filePath);
        });
        return filePath;
    }

}