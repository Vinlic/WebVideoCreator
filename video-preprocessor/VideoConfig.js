import assert from "assert";
import _ from "lodash";

import util from "../lib/util.js";

export default class VideoConfig {

    /** @type {string} - 视频来源URL */
    url;
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
     * @param {string} options.url - 视频来源
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
        const { url, startTime, endTime, seekStart, seekEnd, autoplay, loop, muted } = options;
        assert(util.isURL(url), "url is invalid");
        assert(_.isNil(startTime) || _.isFinite(startTime), "startTime must be number");
        assert(_.isNil(endTime) || _.isFinite(endTime), "endTime must be number");
        assert(_.isNil(seekStart) || _.isFinite(seekStart), "seekStart must be number");
        assert(_.isNil(seekEnd) || _.isFinite(seekEnd), "seekEnd must be number");
        assert(_.isNil(autoplay) || _.isBoolean(autoplay), "autoplay must be number");
        assert(_.isNil(loop) || _.isBoolean(loop), "loop must be number");
        assert(_.isNil(muted) || _.isBoolean(muted), "muted must be number");
        this.url = url;
        this.startTime = _.defaultTo(startTime, 0);
        this.endTime = _.defaultTo(endTime, Infinity);
        this.seekStart = seekStart;
        this.seekEnd = seekEnd;
        this.autoplay = _.defaultTo(autoplay, false);
        this.loop = _.defaultTo(loop, false);
        this.muted = _.defaultTo(muted, false);
    }

}