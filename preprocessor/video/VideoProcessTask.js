import path from "path";
import fs from "fs-extra";
import assert from "assert";
import _ from "lodash";

import ProcessTask from "../base/ProcessTask.js";
import util from "../../lib/util.js";

export default class VideoProcessTask extends ProcessTask {

    filePath;
    audioFilePath;
    format;
    seekStart;
    seekEnd;
    loop;
    muted;

    /**
     * 构造函数
     * 
     * @param {Object} options - 任务选项
     * @param {string} options.filePath - 视频文件路径
     * @param {string} options.format - 视频格式
     * @param {number} [options.seekStart=0] - 裁剪开始时间点（毫秒）
     * @param {number} [options.seekEnd] - 裁剪结束时间点（毫秒）
     * @param {boolean} [options.loop=false] - 是否循环播放
     * @param {boolean} [options.muted=false] - 是否静音
     * @param {number} [options.retryFetchs=2] - 重试次数
     * @param {number} [options.retryDelay=1000] - 重试延迟
     */
    constructor(options) {
        super(options);
        const { filePath, format, seekStart, seekEnd, loop, muted } = options;
        assert(_.isString(filePath), "filePath must be string");
        assert(_.isString(format) && ["mp4", "webm"].includes(format), "format must be string");
        assert(_.isUndefined(seekStart) || _.isFinite(seekStart), "seekStart must be number");
        assert(_.isUndefined(seekEnd) || _.isFinite(seekEnd), "seekEnd must be number");
        assert(_.isUndefined(loop) || _.isBoolean(loop), "loop must be number");
        assert(_.isUndefined(muted) || _.isBoolean(muted), "muted must be number");
        this.filePath = filePath;
        this.format = format;
        this.seekStart = _.defaultTo(seekStart, 0);
        this.seekEnd = seekEnd;
        this.loop = _.defaultTo(loop, false);
        this.muted = _.defaultTo(muted, false);
    }

    async process() {
        // 非静音音频需分离音频文件
        !this.muted && await this.#separateAudioFile();
        if (this.format == "webm") {
            const hasAlphaChannel = await util.checkMediaHasAplhaChannel(this.filePath);
            if (hasAlphaChannel) {

            }
            else {

            }
        }
        else {

        }
        return Buffer.from("123");
    }

    async #separateAudioFile() {
        const audioFormat = "mp3";
        const audioFilePath = `${this.filePath}.${audioFormat}`;
        if (!await fs.pathExists(audioFilePath)) {
            const hasAudioTrack = await util.separateVideoAudioTrack(this.filePath, audioFilePath, {
                audioCodec: "libmp3lame",
                outputFormat: audioFormat
            });
            if (hasAudioTrack)
                this.audioFilePath = audioFilePath;
        }
        else
            this.audioFilePath = audioFilePath;
        if (!this.audioFilePath || !this.#hasSeek())
            return;
        const { dir, base } = path.parse(this.audioFilePath);
        const cuttedAudioFilePath = path.join(dir, `cutted_${this.seekStart || 0}_${this.seekEnd || "n"}-${base}`);
        if (!await fs.pathExists(cuttedAudioFilePath)) {
            await util.cutAudio(this.audioFilePath, cuttedAudioFilePath, {
                seekStart: this.seekStart,
                seekEnd: this.seekEnd
            });
        }
        else
            this.audioFilePath = cuttedAudioFilePath;
    }

    #hasSeek() {
        return this.seekStart > 0 || this.seekEnd > 0;
    }

}