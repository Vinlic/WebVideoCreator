import path from "path";
import assert from "assert";
import fs from "fs-extra"
import _ from "lodash";
import AsyncLock from "async-lock";

import MP4Demuxer from "./MP4Demuxer.js";
import util from "./util.js";

const downloadLock = new AsyncLock();

export default class VideoPreprocessor {

    /** @type {VideoConfig[]} - 视频配置列表 */
    configs;
    /** @type {number} - 并行下载数 */
    parallelDownloads;
    /** @type {number} - 并行处理数 */
    parallelProcesses;
    /** @type {string} - 临时路径 */
    #tmpDirPath;

    constructor(options) {
        assert(_.isObject(options), "VideoPreprocessor options must be Object");
        const { configs } = options;
        assert(_.isArray(configs), "configs must be VideoConfig[]");
        this.configs = configs;
        this.#tmpDirPath = util.rootPathJoin(`tmp/preprocessor/`);
    }

    async start() {
        
        await this.#downloadFile(this.configs[0].src);
    }

    /**
     * 下载视频文件
     *
     * @param {string} src 视频来源
     */
    async #downloadFile(src) {
        const filePath = path.join(this.#tmpDirPath, this.#urlToPath(src));
        await downloadLock.acquire(util.crc32(src), async () => {
            if (await fs.pathExists(filePath)) return filePath;
            await fs.ensureDir(path.dirname(filePath), { recursive: true });
            const writeStream = fs.createWriteStream(`${filePath}.tmp`);
            await util.download(src, writeStream);
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

export class VideoConfig {

    /** @type {string} - 图像来源 */
    src;
    /** @type {number} - 开始播放时间点（毫秒） */
    startTime;
    /** @type {number} - 结束播放时间（毫秒） */
    endTime;
    /** @type {number} - 裁剪开始时间点（毫秒） */
    seekStart;
    /** @type {number} - 裁剪结束时间点（毫秒） */
    seekEnd;
    /** @type {boolean} - 是否自动播放 */
    autoplay;
    /** @type {boolean} - 是否循环播放 */
    loop;
    /** @type {boolean} - 是否静音 */
    muted;

    /**
     * 构造函数
     * 
     * @param {Object} options - 视频配置选项
     * @param {string} options.src - 视频来源
     * @param {number} [options.startTime=0] - 开始播放时间点（毫秒）
     * @param {number} [options.endTime=Infinity] - 结束播放时间点（毫秒）
     * @param {number} [options.seekStart] - 裁剪开始时间点（毫秒）
     * @param {number} [options.seekEnd] - 裁剪结束时间点（毫秒）
     * @param {boolean} [options.autoplay=false] - 是否自动播放
     * @param {boolean} [options.loop=false] - 是否循环播放
     * @param {}
     */
    constructor(options) {
        assert(_.isObject(options), "VideoConfig options must be Object");
        const { src, startTime, endTime, seekStart, seekEnd, autoplay, loop, muted } = options;
        assert(_.isString(src), "src must be string");
        assert(_.isNil(startTime) || _.isFinite(startTime), "startTime must be number");
        assert(_.isNil(endTime) || _.isFinite(endTime), "endTime must be number");
        assert(_.isNil(seekStart) || _.isFinite(seekStart), "seekStart must be number");
        assert(_.isNil(seekEnd) || _.isFinite(seekEnd), "seekEnd must be number");
        assert(_.isNil(autoplay) || _.isBoolean(autoplay), "autoplay must be number");
        assert(_.isNil(loop) || _.isBoolean(loop), "loop must be number");
        assert(_.isNil(muted) || _.isBoolean(muted), "muted must be number");
        this.src = src;
        this.startTime = _.defaultTo(startTime, 0);
        this.endTime = _.defaultTo(endTime, Infinity);
        this.seekStart = seekStart;
        this.seekEnd = seekEnd;
        this.autoplay = _.defaultTo(autoplay, false);
        this.loop = _.defaultTo(loop, false);
        this.muted = _.defaultTo(muted, false);
    }

}