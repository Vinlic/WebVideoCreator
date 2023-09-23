import assert from "assert";
import path from "path";
import fs from "fs-extra";
import _ from "lodash";

import util from "../lib/util.js";

/**
 * 字体
 */
export default class Font {

    /** @type {string} - 字体URL */
    url;
    /** @type {string} - 字体路径 */
    path;
    /** @type {string} - 字体集名称 */
    family;
    /** @type {string} - 字体样式 */
    style;
    /** @type {number|string} - 字体粗细 */
    weight;
    /** @type {string} - 字体格式 */
    format;
    /** @type {number} - 重试拉取次数 */
    retryFetchs;
    /** @type {boolean} - 是否忽略本地缓存 */
    ignoreCache;
    /** @type {string} - 内部字体URL */
    #innerURL;
    /** @type {Promise} - 加载承诺 */
    #loadPromise;
    /** @type {string} - 临时路径 */
    #tmpDirPath;

    /**
     * 构造函数
     * 
     * @param {Object} options - 字体选项
     * @param {string} [options.url] - 字体URL
     * @param {string} [options.path] - 字体路径
     * @param {string} options.family - 字体集名称
     * @param {string} [options.format] - 字体格式
     * @param {string} [options.style] - 字体样式
     * @param {number|string} [options.weight] - 字体粗细
     * @param {number} [options.retryFetchs=2] - 重试拉取次数
     * @param {boolean} [options.ignoreCache=false] - 是否忽略本地缓存
     */
    constructor(options) {
        assert(_.isObject(options), "Font options must be Object");
        const { url, path, family, format, style, weight, retryFetchs, ignoreCache } = options;
        assert(_.isString(url) || _.isString(path), "Font path or url must be string");
        assert(_.isString(family), "Font family must be string");
        assert(_.isNil(format) || _.isString(format), "Font format must be string");
        assert(_.isNil(style) || _.isString(style), "Font style must be string");
        assert(_.isNil(weight) || _.isFinite(weight) || _.isString(weight), "Font weight must be number or string");
        assert(_.isNil(retryFetchs) || _.isFinite(retryFetchs), "Font retryFetchs must be number");
        assert(_.isNil(ignoreCache) || _.isBoolean(ignoreCache), "Font fadeOutDuration must be boolean");
        this.url = url;
        this.path = path;
        this.family = family;
        if(format)
            this.format = format;
        if(this.url)
            this.format = util.getURLExtname(this.url);
        else if(this.path)
            this.format = util.getPathExtname(this.path);
        this.style = style;
        this.weight = _.isNumber(weight) ? parseInt(weight) : weight;
        this.retryFetchs = _.defaultTo(retryFetchs, 2);
        this.ignoreCache = _.defaultTo(ignoreCache, false);
        this.#tmpDirPath = util.rootPathJoin(`tmp/font/`);
    }

    /**
     * 资源加载
     */
    async load() {
        if (this.#loadPromise)
            return this.#loadPromise;
        this.#loadPromise = (async () => {
            await fs.ensureDir(this.#tmpDirPath);
            if (this.path) {
                const filePath = util.rootPathJoin(this.path);
                if (!await fs.pathExists(filePath))
                    throw new Error(`Font source ${filePath} not exists`);
                if (!(await fs.stat(filePath)).isFile())
                    throw new Error(`Font source ${filePath} must be file`);
                const { dir, base } = path.parse(filePath);
                const dirPath = dir.replace(/:/g, "").replace(/\\/g, "/").toLowerCase();
                const destPath = path.join(this.#tmpDirPath, dirPath, base);
                await fs.ensureDir(path.dirname(destPath), { recursive: true });
                await fs.copy(filePath, destPath);
                this.#innerURL = path.join("local_font/", dirPath, base).replace(/\\/g, "/");
            }
            else if(this.url) {
                this.path = await this.#downloadFile(this.url);
                this.#innerURL = path.join("local_font/", util.urlToPath(this.url)).replace(/\\/g, "/");
            }

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
            if (!this.ignoreCache && await fs.pathExists(filePath)) return filePath;
            await fs.ensureDir(path.dirname(filePath), { recursive: true });
            const writeStream = fs.createWriteStream(`${filePath}.tmp`);
            await util.download(url, writeStream, {
                mimesLimit: [
                    /^font\//,
                    /^application\/(x-)?font/,
                    /^application\/vnd.ms-fontobject/
                ],
                retryFetchs: this.retryFetchs
            });
            await fs.move(`${filePath}.tmp`, filePath);
        });
        return filePath;
    }

    /**
     * 转换为字体声明
     * 
     * @returns {string} - 字体声明
     */
    toFontFace() {
        assert(this.#innerURL, "Font not loaded");
        return  `@font-face{font-family:"${this.family}";${this.style ? `font-style:${this.style};` : ""}${this.weight ? `font-weight:${this.weight};` : ""}src:url("${this.#innerURL}") format("${this.format}")}`;
    }

}