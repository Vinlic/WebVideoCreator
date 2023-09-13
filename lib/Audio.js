import fs from "fs-extra";
import _ from "lodash";

import util from "./util.js";

export default class Audio {

    /** @type {string} - 音频路径 */
    path;
    /** @type {string} - 音频URL */
    url;
    /** @type {number} - 时间轴中音频的起始时间点（毫秒） */
    startTime;
    /** @type {number} - 时间轴中音频的结束时间点（毫秒） */
    endTime;
    /** @type {boolean} - 音频是否循环播放 */
    loop;
    /** @type {number} - 音频时长裁剪起始时间点（毫秒） */
    seekStart;
    /** @type {number} - 音频时长裁剪结束实际点（毫秒） */
    seekEnd;
    /** @type {number} - 音频淡入时长（毫秒） */
    fadeInDuration;
    /** @type {number} - 音频淡出时长（毫秒 */
    fadeOutDuration;

    /**
     * 构造函数
     * 
     * @param {Object} options - 音频选项
     * @param {string} [options.path] - 音频路径
     * @param {string} [options.url] - 音频URL
     * @param {number} [options.startTime] - 时间轴中音频的起始时间点（毫秒）
     * @param {number} [options.endTime] - 时间轴中音频的结束时间点（毫秒）
     * @param {boolean} [options.loop=false] - 音频是否循环播放
     * @param {number} [options.seekStart] - 音频时长裁剪起始时间点（毫秒）
     * @param {number} [options.seekEnd] - 音频时长裁剪结束实际点（毫秒）
     * @param {number} [options.fadeInDuration] - 音频淡入时长（毫秒）
     * @param {number} [options.fadeOutDuration] - 音频淡出时长（毫秒
     */
    constructor(options) {
        assert(_.isObject(options), "addAudio options must be object");
        const { path, url, startTime, endTime, loop, seekStart, seekEnd, fadeInDuration, fadeOutDuration } = options;
        assert(_.isString(path) || _.isString(url), "Audio path or url must be string");
        assert(_.isUndefined(startTime) || _.isFinite(startTime), "Audio startTime must be number");
        assert(_.isUndefined(endTime) || _.isFinite(endTime), "Audio endTime must be number");
        assert(_.isUndefined(loop) || _.isBoolean(loop), "Audio loop must be boolean");
        assert(_.isUndefined(seekStart) || _.isFinite(seekStart), "Audio seekStart must be number");
        assert(_.isUndefined(seekEnd) || _.isFinite(seekEnd), "Audio seekEnd must be number");
        assert(_.isUndefined(fadeInDuration) || _.isFinite(fadeInDuration), "Audio fadeInDuration must be number");
        assert(_.isUndefined(fadeOutDuration) || _.isFinite(fadeOutDuration), "Audio fadeOutDuration must be number");
        this.path = path;
        this.url = url;
        this.startTime = startTime;
        this.endTime = endTime;
        this.loop = _.defaultTo(loop, false);
        this.seekStart = seekStart;
        this.seekEnd = seekEnd;
        this.fadeInDuration = fadeInDuration;
        this.fadeOutDuration = fadeOutDuration;
    }

    async checkSource() {
        if(this.path) {
            if(!await fs.pathExists(this.path))
                throw new Error(`Audio source ${this.path} not exists`);
            if(!(await fs.stat(this.path)).isFile())
                throw new Error(`Audio source ${this.path} must be file`);
        }
        else if(this.url) {
            const { mime } = await util.checkRemoteResource(this.url);
            if(!/^audio\//.test(mime) || mime == "application/octet-stream")
                throw new Error(`Resource ${this.url} content type ${mime} is not audio type`);
        }
    }

}