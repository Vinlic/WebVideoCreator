import os from "os";
import path from "path";
import crypto from 'crypto';
import assert from "assert";
import { Writable } from 'stream';
import { fileURLToPath } from "url";
import fs from "fs-extra";
import CRC32 from "crc-32";
import ffmpeg from "fluent-ffmpeg";
import got from "got";
import _ from "lodash";

// 项目根路径
const ROOT_PATH = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export default {

    /**
     * 拼接路径
     * 
     * @param {string} relativePath - 相对路径
     * @returns {string} - 绝对路径
     */
    rootPathJoin(relativePath) {
        if (!relativePath)
            return relativePath;
        // 如果是绝对路径则直接返回绝对路径
        if (path.isAbsolute(relativePath))
            return relativePath;
        return path.join(ROOT_PATH, relativePath);
    },

    /**
     * 检查远端资源是否可访问
     * 
     * @param {string} url - 资源URL
     * @param {string[]|RegExp[]} [mimesLimit] - MIME类型限制列表
     */
    async checkRemoteResource(url, mimesLimit) {
        url = url.replace("localhost", "127.0.0.1");
        const response = await got.head(url);
        if (response.statusCode >= 400)
            reject(new Error(`Resource ${url} request error: [${response.statusCode || 0}] ${response.statusMessage || "Unknown"}`));
        const mime = response.headers["content-type"] || "unknown";
        const size = response.headers["content-length"];
        if (_.isArray(mimesLimit)) {
            let matched;
            for (let limit of mimesLimit) {
                if (limit == mime || (_.isRegExp(limit) && limit.test(mime))) {
                    matched = true;
                    break;
                }
            }
            if (!matched)
                reject(new Error(`Resource ${url} content type ${mime} is not supported`));
        }
        return {
            mime,
            size: size ? Number(size) : null
        };
    },

    /**
     * 获取媒体元数据
     * 
     * @param {string} source - 媒体来源
     * @returns {Object} - 媒体元数据
     */
    async getMediaMetadata(source) {
        if (!await fs.pathExists(source) && !this.isURL(source))
            throw new Error(`media source ${source} not found`);
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(source, (err, metadata) => {
                if (err) return reject(err);
                resolve(metadata);
            });
        });
    },

    /**
     * 获取媒体视频编码器
     * 
     * @param {string} source - 媒体来源
     * @param {boolean} allStreams - 是否返回所有流的编码器信息
     * @returns 
     */
    async getMediaVideoCodecName(source, allStreams = false) {
        const { streams } = await this.getMediaMetadata(source);
        const videoStreams = streams.filter(v => v.codec_type === "video");
        if (!videoStreams.length)
            throw new Error(`${source} video stream not found`);
        return allStreams ? videoStreams.map(stream => stream.codec_name) : videoStreams[0].codec_name;
    },

    /**
     * 获取媒体时长
     * 
     * @param {string} source - 媒体来源
     * @returns {number} - 媒体时长（毫秒）
     */
    async getMediaDuration(source) {
        const metadata = await this.getMediaMetadata(source);  //获取媒体信息
        if (!metadata || !metadata.format || !_.isFinite(metadata.format.duration))
            throw new Error(`Media ${source} duration invalid`);
        return (metadata.format.duration || 0) * 1000;
    },

    /**
     * 检查媒体是否具有透明通道
     * 
     * @param {string} source - 媒体来源
     * @returns {boolean} = 是否具有透明通道
     */
    async checkMediaHasAplhaChannel(source) {
        const metadata = await this.getMediaMetadata(source);  //获取媒体信息
        if (!metadata || !metadata.streams || !metadata.streams[0])
            throw new Error(`Media ${source} streams invalid`);
        if (!metadata.streams[0].tags || !metadata.streams[0].tags["ALPHA_MODE"])
            return false;
        return Number(metadata.streams[0].tags["ALPHA_MODE"]) > 0;
    },

    /**
     * 判断是否URL
     * 
     * @param {string} value - 检查值
     * @returns {boolean} - 是否URL
     */
    isURL(value) {
        return !_.isUndefined(value) && /^(http|https)/.test(value);
    },

    /**
     * 判断是否处于Linux平台
     * 
     * @returns {boolean} - 是否Linux平台
     */
    isLinux() {
        return os.platform() !== "win32";
    },

    /**
     * 判断是否写入流
     * 
     * @param {*} value - 值
     * @returns {boolean} - 是否写入流
     */
    isWriteStream(value) {
        return value && (value instanceof Writable || "writable" in value || value.writable);
    },

    /**
     * 拼接URL
     * 
     * @param  {...any} values - 字符串
     * @returns {string} - URL
     */
    urlJoin(...values) {
        let url = "";
        for (let i = 0; i < values.length; i++)
            url += `${i > 0 ? "/" : ""}${values[i].replace(/^\/*/, "").replace(/\/*$/, "")}`;
        return url;
    },

    /**
     * URL转本地路径
     * 
     * @param {string} value - URL
     * @returns {string} - 路径
     */
    urlToPath(value) {
        const { host, pathname } = new URL(value);
        return `${host.replace(/\.|:/g, "_")}${pathname.replace(/\.\.|:|@|\?|\*/g, "_")}`
    },

    /**
     * 获取URL扩展名
     * 
     * @param {string} value - URL
     * @returns {string} - 扩展名
     */
    getURLExtname(value) {
        if (!this.isURL(value))
            return null;
        const { pathname } = new URL(value);
        const extname = path.extname(pathname);
        if (!extname)
            return null;
        return extname.substring(1);
    },

    /**
     * 获取路径扩展名
     * 
     * @param {string} value - 路径
     * @returns {string} - 扩展名
     */
    getPathExtname(value) {
        return path.extname(value).substring(1);
    },

    /**
     * 毫秒转H:m:s.ms时间字符串
     * 
     * @param {number} milliseconds - 毫秒
     * @returns {string} - 时间字符串
     */
    millisecondsToHmss(milliseconds) {
        if (_.isString(milliseconds)) return milliseconds;
        milliseconds = parseInt(milliseconds);
        const sec = Math.floor(milliseconds / 1000);
        const hours = Math.floor(sec / 3600);
        const minutes = Math.floor((sec - hours * 3600) / 60);
        const seconds = sec - hours * 3600 - minutes * 60;
        const ms = milliseconds % 60000 - seconds * 1000;
        return `${hours > 9 ? hours : "0" + hours}:${minutes > 9 ? minutes : "0" + minutes}:${seconds > 9 ? seconds : "0" + seconds}.${ms}`;
    },

    /**
     * 将时长转换为总帧数
     * 
     * @param {number} duration - 时长
     * @param {number} fps - 帧率
     * @returns {number} - 总帧数
     */
    durationToFrameCount(duration, fps) {
        assert(_.isFinite(duration), "duration must be number");
        assert(_.isFinite(fps), "fps must be number");
        return Math.floor(duration / 1000 * fps)
    },

    /**
     * 将总帧数转换为时长
     * 
     * @param {number} frameCount - 总帧数
     * @param {number} fps - 帧率
     * @returns {number} - 时长
     */
    frameCountToDuration(frameCount, fps) {
        assert(_.isFinite(frameCount), "duration must be number");
        assert(_.isFinite(fps), "fps must be number");
        return frameCount / fps;
    },

    /**
     * 从视频捕获截图
     */
    async captureScreenshot(source, dest, timemark) {
        return new Promise((resolve, reject) => {
            ffmpeg(source)
                .screenshot({
                    folder: path.dirname(dest),
                    filename: path.basename(dest),
                    timemarks: [this.millisecondsToHmss(timemark)]
                })
                .once("error", reject)
                .once("end", resolve);
        });
    },

    /**
     * 从视频分离音轨
     * 
     * @param {string} source 视频来源
     * @param {string} dest 输出目标
     * @param {Object} [options] - 输出选项
     * @param {number} [options.seekStart] - 裁剪开始时间点
     * @param {number} [options.seekEnd] - 裁剪结束时间点
     * @param {string} [options.audioEncoder="aac"] - 音频编码器
     * @param {string} [options.audioBitrate="320k"] - 音频码率
     * @param {string} [options.audioSampleRate="44100"] - 音频采样率
     * @param {string} [options.outputFormat="aac"] - 输出格式
     * @returns {boolean} - 是否已分离音频
     */
    async separateVideoAudioTrack(source, dest, options = {}) {
        assert(_.isObject(options), "options must be Object");
        const { seekStart, seekEnd, audioEncoder = "libmp3lame", audioBitrate = "320k",
            audioSampleRate = "44100", outputFormat = "mp3" } = options;
        assert(_.isString(source), "source must be an url or path");
        assert(_.isString(dest), "dest must be an path");
        const acodeer = ffmpeg();
        acodeer.addInput(source);
        _.isFinite(seekStart) &&
            acodeer.addInputOption("-ss", this.millisecondsToHmss(seekStart));
        _.isFinite(seekEnd) &&
            seekEnd > (seekStart || 0) &&
            acodeer.addInputOption("-to", this.millisecondsToHmss(seekEnd));
        let audioDuration;
        if (_.isFinite(seekEnd))
            audioDuration = seekEnd - (seekStart || 0);
        else
            audioDuration = (await this.getMediaDuration(source)) - (seekStart || 0);
        return new Promise((resolve, reject) => {
            acodeer
                .addInputOption("-vn")
                .complexFilter("[0]apad")
                .setDuration(audioDuration / 1000)
                .audioCodec(audioEncoder)
                .audioBitrate(audioBitrate)
                .outputOptions(`-ar ${audioSampleRate}`)
                .toFormat(outputFormat)
                .output(dest)
                .once("error", (err) => {
                    // 无音频返回false
                    if (
                        err.message.indexOf("no streams") != -1 ||
                        err.message.indexOf("not contain") != -1
                    )
                        return resolve(false);
                    reject(err);
                })
                .once("end", () => resolve(true))
                .run();
        });
    },

    /**
     * 音频裁剪
     * 
     * @param {string} source 视频来源
     * @param {string} dest 输出目标
     * @param {Object} [options] - 输出选项
     * @param {number} [options.seekStart] - 裁剪开始时间点
     * @param {number} [options.seekEnd] - 裁剪结束时间点
     */
    async clipAudio(source, dest, options = {}) {
        assert(_.isObject(options), "options must be Object");
        const { seekStart = 0, seekEnd } = options;
        assert(_.isString(source), "source must be an url or path");
        assert(_.isString(dest), "dest must be an path");
        const acodeer = ffmpeg();
        acodeer.addInput(source);
        _.isFinite(seekStart) &&
            acodeer.addInputOption("-ss", this.millisecondsToHmss(seekStart));
        _.isFinite(seekEnd) &&
            seekEnd > (seekStart || 0) &&
            acodeer.addInputOption("-to", this.millisecondsToHmss(seekEnd));
        return new Promise((resolve, reject) => {
            acodeer
                .audioCodec("copy")
                .output(dest)
                .once("error", reject)
                .once("end", resolve)
                .run();
        });
    },

    rgbToHex(r, g, b) {
        return ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    },

    hexToRgb(hex) {
        const value = parseInt(hex.replace(/^#/, ""), 16);
        return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
    },

    md5(value) {
        return crypto.createHash("md5").update(value).digest("hex");
    },

    crc32(value) {
        return _.isBuffer(value) ? CRC32.buf(value) : CRC32.str(value);
    },

    /**
     * 下载资源
     * 
     * @param {string} url - 资源URL
     * @param {string|writable} dest - 写入目标
     * @param {Object} [options] - 下载选项
     * @param {Function} [options.onProgress] - 下载进度回调
     * @param {string[]|RegExp[]} [options.mimesLimit] - 限制MIME类型列表
     * @param {string[]} [options.retryFetchs=0] - 重试次数
     * @param {string[]} [options.retryDelay=500] - 重试延迟
     */
    async download(url, dest, options = {}) {
        const { onProgress, mimesLimit, retryFetchs = 0, retryDelay = 500, _retryCount = 0, ..._options } = options;
        assert(this.isURL(url), `url ${url} is invalid`);
        url = url.replace("localhost", "127.0.0.1");
        let writeStream;
        if (_.isString(dest))
            writeStream = fs.createWriteStream(dest);
        else if (this.isWriteStream(dest))
            writeStream = dest;
        else
            throw new Error("Download dest is invalid");
        const { size } = await this.checkRemoteResource(url, mimesLimit);
        const response = await got.stream(url, _options);
        return await new Promise((resolve, reject) => {
            if (onProgress) {
                let writtenSize = 0;
                response.on("data", (chunk) => {
                    writtenSize += chunk.length;
                    onProgress(Math.floor(writtenSize / size * 100)); // 更新进度
                });
            }
            response.on("end", resolve);
            response.on("error", err => {
                if (retryFetchs > _retryCount) {
                    setTimeout(() => {
                        resolve(this.download(url, dest, { ...options, _retryCount: _retryCount + 1 }))
                    }, retryDelay);
                }
                else
                    reject(new Error(`Download resource ${url} failed: ${err.message}`));
            });
            response.pipe(writeStream);
        });
    }

}