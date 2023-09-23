import VideoConfig from "../preprocessor/video/VideoConfig.js";
import MP4Demuxer from "./MP4Demuxer.js";

export default class VideoCanvas {

    /** @type {string} - 视频URL */
    url;
    /** @type {string} - 视频格式 */
    format;
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
    /** @type {boolean} - 是否强制循环 */
    loop;
    /** @type {boolean} - 是否静音 */
    muted;
    /** @type {number} - 重试下载次数 */
    retryFetchs;
    /** @type {boolean} - 是否忽略本地缓存 */
    ignoreCache;
    /** @type {number} - 帧索引 */
    frameIndex = 0;
    /** @type {number} - 当前播放时间点（毫秒） */
    currentTime = 0;
    /** @type {boolean} - 是否已销毁 */
    destoryed = false;
    loaded = false;

    /**
     * 构造函数
     * 
     * @param {Object} options - 视频配置选项
     * @param {string} options.url - 视频URL
     * @param {string} [options.format] - 视频格式（mp4/webm）
     * @param {number} [options.startTime=0] - 开始播放时间点（毫秒）
     * @param {number} [options.endTime] - 结束播放时间点（毫秒）
     * @param {number} [options.seekStart=0] - 裁剪开始时间点（毫秒）
     * @param {number} [options.seekEnd] - 裁剪结束时间点（毫秒）
     * @param {boolean} [options.autoplay=false] - 是否自动播放
     * @param {boolean} [options.loop=false] - 是否循环播放
     * @param {boolean} [options.muted=false] - 是否静音
     * @param {boolean} [options.retryFetchs=2] - 重试下载次数
     * @param {boolean} [options.ignoreCache=false] - 是否忽略本地缓存
     */
    constructor(options) {
        if (!options instanceof Object)
            throw new Error("VideoCanvas options must be Object");
        const { url, format, startTime, endTime, seekStart, seekEnd, autoplay, loop, muted, retryFetchs, ignoreCache } = options;
        this.url = url || undefined;
        this.format = format || undefined;
        this.startTime = startTime || 0;
        this.endTime = endTime || undefined;
        this.seekStart = seekStart || 0;
        this.seekEnd = seekEnd || undefined;
        this.autoplay = autoplay || false;
        this.loop = loop || false;
        this.muted = muted || false;
        this.retryFetchs = retryFetchs || 2;
        this.ignoreCache = ignoreCache || false;
    }

    /**
     * 绑定画布元素
     * 
     * @param {HTMLCanvasElement} canvas - 画布元素
     * @param {Object} [options] - 画布选项
     * @param {boolean} [options.alpha=true] - 是否支持透明通道
     * @param {boolean} [options.imageSmoothingEnabled=true] - 是否开启抗锯齿
     */
    bind(canvas, options = {}) {
        const { alpha = true, imageSmoothingEnabled = true } = options;
        this.canvas = canvas;
        // 获取画布2D上下文
        this.canvasCtx = this.canvas.getContext("2d", { alpha });
        // 设置抗锯齿开关
        this.canvasCtx.imageSmoothingEnabled = imageSmoothingEnabled;
    }

    canPlay(time) {
        if (this.destoryed) return;
        const { startTime, endTime } = this;
        if (time < startTime || time >= endTime)
            return false;  //如果当前时间超过元素开始结束时间则判定未不可播放
        return true;
    }

    async load() {
        try {
            console.time();
            this.loaded = true;
            const response = await window.captureCtx.fetch("video_preprocess", {
                method: "POST",
                body: JSON.stringify(this._exportConfig()),
                retryFetchs: 0
            });
            console.timeEnd();
            if (!response)
                return;
            const buffer = await response.arrayBuffer();
            const data = this._unpackData(buffer);
            console.log(data.buffer.length);
            // this.loaded = true;
        }
        catch (err) {
            console.log(err);
        }
    }

    isReady() {
        return this.loaded;
    }

    async seek() {

    }

    isEnd() {

    }

    canDestory() {
        return false;
    }

    reset() {

    }

    destory() {

    }

    /**
     * 导出视频配置
     * 
     * @returns {VideoConfig} - 视频配置
     */
    _exportConfig() {
        return {
            url: this.url,
            format: this.format,
            startTime: this.startTime,
            endTime: this.endTime,
            seekStart: this.seekStart,
            seekEnd: this.seekEnd,
            autoplay: this.autoplay,
            loop: this.loop,
            muted: this.muted,
            retryFetchs: this.retryFetchs,
            ignoreCache: this.ignoreCache
        };
    }

    /**
     * 解包数据
     * 从封装的ArrayBuffer中提取原始数据对象
     * 
     * @param {ArrayBuffer} packedData - 已封装数据
     * @returns {Object} - 原始数据对象
     */
    _unpackData(packedData) {
        const dataView = new DataView(packedData);
        let delimiterIndex = -1;
        for (let i = 0; i < dataView.byteLength; i++) {
            if (dataView.getUint8(i) === '!'.charCodeAt(0)) {
                delimiterIndex = i;
                break;
            }
        }
        if (delimiterIndex === -1)
            throw new Error("Invalid data format: header delimiter not found");
        const lengthBytes = new Uint8Array(dataView.buffer, 0, delimiterIndex);
        const objLength = parseInt(String.fromCharCode(...lengthBytes));
        if (isNaN(objLength) || objLength <= 0 || objLength > dataView.byteLength - delimiterIndex - 1)
            throw new Error("Invalid data format: Invalid data length");
        const objBytes = new Uint8Array(dataView.buffer, delimiterIndex + 1, objLength);
        const obj = JSON.parse(new TextDecoder("utf-8").decode(objBytes));
        const bufferOffset = delimiterIndex + 1 + objLength;
        for (const key in obj) {
            if (Array.isArray(obj[key]) && obj[key][0] === "buffer") {
                const [_, start, end] = obj[key];
                obj[key] = new Uint8Array(dataView.buffer, bufferOffset + start, end - start);
            }
        }
        return obj;
    }

}