import os from "os";
import path from "path";
import http from "http";
import { fileURLToPath } from "url";
import fs from "fs-extra";
import ffmpeg from "fluent-ffmpeg";
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
        if(!relativePath)
            return relativePath;
        // 如果是绝对路径则直接返回绝对路径
        if(path.isAbsolute(relativePath))
            return relativePath;
        return path.join(ROOT_PATH, relativePath);
    },

    /**
     * 检查远端资源是否可访问
     * 
     * @param {string} url - 资源URL
     * @param {string[]} [mimesLimit] - MIME类型限制列表
     */
    async checkRemoteResource(url, mimesLimit) {
        await new Promise((resolve, reject) => {
            const { hostname, port, pathname } = new URL(url);
            const req = http.request({
                method: "head",
                hostname,
                port,
                path: pathname
            }, res => {
                if (res.statusCode >= 400)
                    reject(new Error(`Resource ${url} request error: [${res.statusCode || 0}] ${res.statusMessage || "Unknown"}`));
                const mime = res.headers["content-type"] || "unknown";
                const size = res.headers["content-length"];
                if (_.isArray(mimesLimit) && !mimes.includes(mime))
                    reject(new Error(`Resource ${url} content type ${mime} is not supported`));
                resolve({
                    mime,
                    size: size ? Number(size) : null
                });
            });
            req.on("error", reject);
            req.end();
        });
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
     * 获取媒体时长
     * 
     * @param {string} source - 媒体来源
     * @returns {number} - 媒体时长（毫秒）
     */
    async getMediaDuration(source) {
        const metadata = await this.getMediaMetadata(source);  //获取媒体信息
        if (!metadata || !metadata.format || !_.isFinite(metadata.format.duration))
            throw new Error(`video ${source} duration invalid`);
        return (metadata.format.duration || 0) * 1000;
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
    }

}