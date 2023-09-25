import assert from "assert";
import _ from "lodash";

import util from "../../lib/util.js";

export default class VideoConfig {

    /** @type {string} - 视频URL */
    url;
    /** @type {number} - 开始播放时间点（毫秒） */
    startTime;
    /** @type {number} - 结束播放时间（毫秒） */
    endTime;
    /** @type {number} - 裁剪开始时间点（毫秒） */
    seekStart;
    /** @type {number} - 裁剪结束时间点（毫秒） */
    seekEnd;
    /** @type {number} - 音频淡入时长（毫秒） */
    fadeInDuration;
    /** @type {number} - 音频淡出时长（毫秒） */
    fadeOutDuration;
    /** @type {boolean} - 是否自动播放 */
    autoplay;
    /** @type {boolean} - 是否循环播放 */
    loop;
    /** @type {boolean} - 是否静音 */
    muted;
    /** @type {number} - 重试下载次数 */
    retryFetchs;
    /** @type {boolean} - 是否忽略本地缓存 */
    ignoreCache;

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
     * @param {number} [options.fadeInDuration] - 音频淡入时长（毫秒）
     * @param {number} [options.fadeOutDuration] - 音频淡出时长（毫秒）
     * @param {boolean} [options.autoplay=false] - 是否自动播放
     * @param {boolean} [options.loop=false] - 是否循环播放
     * @param {boolean} [options.muted=false] - 是否静音
     * @param {boolean} [options.retryFetchs=2] - 重试下载次数
     * @param {boolean} [options.ignoreCache=false] - 是否忽略本地缓存
     */
    constructor(options) {
        assert(_.isObject(options), "VideoConfig options must be Object");
        const { url, format, startTime, endTime, seekStart, seekEnd, fadeInDuration, fadeOutDuration, autoplay, loop, muted, retryFetchs, ignoreCache } = options;
        assert(util.isURL(url), "url is invalid");
        assert(_.isUndefined(format) || _.isString(format), "format mudt be string");
        assert(_.isUndefined(startTime) || _.isFinite(startTime), "startTime must be number");
        assert(_.isUndefined(endTime) || _.isFinite(endTime), "endTime must be number");
        assert(_.isUndefined(seekStart) || _.isFinite(seekStart), "seekStart must be number");
        assert(_.isUndefined(seekEnd) || _.isFinite(seekEnd), "seekEnd must be number");
        assert(_.isUndefined(fadeInDuration) || _.isFinite(fadeInDuration), "fadeInDuration must be number");
        assert(_.isUndefined(fadeOutDuration) || _.isFinite(fadeOutDuration), "fadeOutDuration must be number");
        assert(_.isUndefined(autoplay) || _.isBoolean(autoplay), "autoplay must be number");
        assert(_.isUndefined(loop) || _.isBoolean(loop), "loop must be number");
        assert(_.isUndefined(muted) || _.isBoolean(muted), "muted must be number");
        this.url = url;
        this.format = _.defaultTo(format, util.getURLExtname(this.url));
        this.startTime = _.defaultTo(startTime, 0);
        this.endTime = _.defaultTo(endTime, undefined);;
        this.seekStart = _.defaultTo(seekStart, undefined);
        this.seekEnd = _.defaultTo(seekEnd, undefined);
        this.fadeInDuration = fadeInDuration;
        this.fadeOutDuration = fadeOutDuration;
        this.autoplay = _.defaultTo(autoplay, false);
        this.loop = _.defaultTo(loop, false);
        this.muted = _.defaultTo(muted, false);
        this.retryFetchs = _.defaultTo(retryFetchs, 2);
        this.ignoreCache = _.defaultTo(ignoreCache, false);
    }

}