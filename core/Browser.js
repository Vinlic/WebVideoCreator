import assert from "assert";
import AsyncLock from "async-lock";
import puppeteer, { Browser as _Browser } from "puppeteer-core";
import genericPool, { Pool as _Pool } from "generic-pool";
import _ from "lodash";

import Pool from "./ResourcePool.js";
import Page from "./Page.js";
import globalConfig from "../lib/global-config.js";
import installBrowser from "../lib/install-browser.js";
import logger from "../lib/logger.js";
import util from "../lib/util.js";

// 异步锁
const asyncLock = new AsyncLock();
// 浏览器计数
let browserIndex = 1;

/**
 * 浏览器
 */
export default class Browser {

    /** 浏览器状态枚举 */
    static STATE = {
        /** 未初始化 */
        UNINITIALIZED: Symbol("UNINITIALIZED"),
        /** 已就绪 */
        READY: Symbol("READY"),
        /** 不可用 */
        UNAVAILABLED: Symbol("UNAVAILABLED"),
        /** 已关闭 */
        CLOSED: Symbol("CLOSED")
    };

    /**
     * @typedef {Object} PageOptions
     * @property {number} [width] - 页面视窗宽度
     * @property {number} [height] - 页面视窗高度
     * @property {string} [userAgent] - 用户UA
     * @property {number} [beginFrameTimeout=5000] - BeginFrame超时时间（毫秒）
     * @property {string} [frameFormat="jpeg"] - 帧图格式
     * @property {number} [frameQuality=80] - 帧图质量（0-100）
     * @property {string[]} [args] - 浏览器启动参数
     */

    /** @type {string} - 浏览器ID */
    id = `Browser@${browserIndex++}`;
    /** @type {Browser.STATE} - 浏览器状态 */
    state = Browser.STATE.UNINITIALIZED;
    /** @type {Pool} - 浏览器池 */
    parent = null;
    /** @type {_Pool} - 浏览器页面资源池 */
    #pagePool;
    /** @type {_Browser} - 浏览器实例 */
    target = null;
    /** @type {number} - 页面资源最大数量 */
    numPageMax;
    /** @type {number} - 页面资源最小数量 */
    numPageMin;
    /** @type {string} - 浏览器入口文件路径 */
    executablePath;
    /** @type {boolean=true} - 是否使用GPU加速渲染 */
    useGPU;
    /** @type {boolean=true} - 3D渲染后端是否使用Angle，建议开启 */
    useAngle;
    /** @type {boolean=false} - 是否禁用共享内存，当/dev/shm较小时建议开启此选项 */
    disableDevShm;
    /** @type {string[]} - 浏览器启动参数 */
    args = [];
    /** @type {PageOptions} - 浏览器日志是否输出到控制台 */
    pageOptions = {};
    #launchCallbacks = [];
    #firstPage = true;
    closed = false;

    /**
     * 构造函数
     * 
     * @param {Pool} parent - 浏览器资源池
     * @param {Object} options - 浏览器选项
     * @param {number} options.numPageMax - 页面资源最大数量
     * @param {number} options.numPageMin - 页面资源最小数量
     * @param {string} [options.executablePath] - 浏览器入口文件路径
     * @param {boolean} [options.useGPU=true] - 是否使用GPU加速渲染
     * @param {boolean} [options.useAngle=true] - 3D渲染后端是否使用Angle，建议开启
     * @param {boolean} [options.disableDevShm=false] - 是否禁用共享内存，当/dev/shm较小时建议开启此选项
     * @param {string[]} [options.args] - 浏览器启动参数
     * @param {PageOptions} [options.pageOptions] - 页面选项
     */
    constructor(parent, options) {
        assert(parent instanceof Pool, "Browser parent must be Pool");
        this.parent = parent;
        assert(_.isObject(options), "Browser options must be object");
        const { numPageMax, numPageMin, executablePath, useGPU, useAngle, disableDevShm, args, pageOptions } = options;
        assert(_.isFinite(numPageMax), "Browser numPageMax must be number");
        assert(_.isFinite(numPageMin), "Browser numPageMin must be number");
        assert(_.isUndefined(executablePath) || _.isBoolean(executablePath), "Browser executablePath must be string");
        assert(_.isUndefined(useGPU) || _.isBoolean(useGPU), "Browser useGPU must be boolean");
        assert(_.isUndefined(useAngle) || _.isBoolean(useAngle), "Browser useAngle must be boolean");
        assert(_.isUndefined(disableDevShm) || _.isBoolean(disableDevShm), "Browser disableDevShm must be boolean");
        assert(_.isUndefined(args) || _.isArray(args), "Browser args must be array");
        assert(_.isUndefined(pageOptions) || _.isObject(pageOptions), "Browser pageOptions must be object");
        this.numPageMax = numPageMax;
        this.numPageMin = numPageMin;
        this.executablePath = executablePath;
        this.useGPU = _.defaultTo(useGPU, true);
        this.useAngle = _.defaultTo(useAngle, true);
        this.disableDevShm = _.defaultTo(disableDevShm, false);
        this.args = _.defaultTo(args, []);
        this.pageOptions = _.defaultTo(pageOptions, {});
    }

    /**
     * 浏览器资源初始化
     */
    async init() {
        const { executablePath } = await installBrowser();
        // 启动浏览器
        this.target = await puppeteer.launch({
            // BeginFrameControl必需处于无头模式下可用，新无头"new"暂时不可用，请关注进展：https://bugs.chromium.org/p/chromium/issues/detail?id=1480747
            headless: true,
            // 浏览器入口文件路径
            executablePath: globalConfig.browserExecutablePath || executablePath,
            // 忽略HTTPS错误
            ignoreHTTPSErrors: true,
            // 浏览器启动超时时间（毫秒）
            timeout: 30000,
            // 是否输出调试信息到控制台
            dumpio: globalConfig.browserDebug || false,
            // 是否使用管道通信
            pipe: false,
            // 用户目录路径
            userDataDir: "tmp/browser",
            // 浏览器启动参数
            args: this.#generateArgs()
        });
        // 浏览器关闭时自动处理
        this.target.once("disconnected", () => {
            this.close()
                .catch(err => logger.error(`Browser ${this.id} close error:`, err));
        });
        // 创建页面池
        this.#createPagePool();
        // 预热页面池
        await this.#warmupPagePool();
        // 启动回调
        this.#launchCallbacks.forEach(fn => fn());
        // 设置浏览器状态为已就绪
        this.#setState(Browser.STATE.READY);
    }

    /**
     * 创建页面池
     */
    #createPagePool() {
        this.#pagePool = genericPool.createPool({
            create: this.#createPage.bind(this),
            destroy: target => target.close(),
            validate: target => target.isReady()
        }, {
            max: this.numPageMax,
            min: this.numPageMin,
            autostart: false
        });
        this.#pagePool.on('factoryCreateError', (error) => {
            const client = this.#pagePool._waitingClientsQueue.dequeue();
            if (!client) return logger.error(error);
            client.reject(error);
        });
    }

    /**
     * 预热页面池
     */
    async #warmupPagePool() {
        this.#pagePool.start();
        await this.#pagePool.ready();
    }

    /**
     * 获取可用页面资源
     * 
     * @returns {Page} - 页面资源
     */
    async acquirePage() {
        return await this.#pagePool.acquire();
    }

    /**
     * 创建页面资源
     * 
     * @returns {Page} - 页面资源
     */
    async #createPage() {
        if (!this.target)
            await new Promise(resolve => this.#launchCallbacks.push(resolve));
        const page = new Page(this, { ...this.pageOptions, _firstPage: this.firstPage });
        await page.init();
        return page;
    }

    /**
     * 释放页面资源
     * 
     * @param {Page} page - 页面资源
     */
    async releasePage(page) {
        await this.#pagePool.release(page);
    }

    /**
     * 销毁页面资源
     * 
     * @param {Page} page - 页面资源
     */
    async destoryPage(page) {
        await this.#pagePool.destroy(page);
    }

    /**
     * 释放浏览器资源
     */
    async release() {
        await asyncLock.acquire("release", async () => {
            // 通知浏览器资源池释放资源
            await this.parent.releaseBrowser(this);
            // 设置浏览器状态为已就绪
            this.#setState(Browser.STATE.READY);
        });
    }

    /**
     * 关闭浏览器
     */
    async close() {
        await asyncLock.acquire("close", async () => {
            if (this.isClosed())
                return;
            // 设置浏览器状态为已关闭
            this.#setState(Browser.STATE.CLOSED);
            // 清除页面池资源
            await this.#pagePool.clear();
            // 通知浏览器资源池销毁资源
            await this.parent.destoryBrowser(this);
            // 如果浏览器已关闭则跳过
            if (!this.target || this.target.isClosed())
                return;
            this.target.close();
            this.target = null;
        });
    }

    /**
     * 获取浏览器页面数量
     * 
     * @returns {number} - 页面数量
     */
    async getPageCount() {
        return (await this.target.pages()).length;
    }

    /**
     * 生成浏览器启动参数
     * 
     * @returns {Array} - 参数列表
     */
    #generateArgs() {
        return [
            // 禁用沙箱
            "--no-sandbox",
            // 禁用UID沙箱
            "--disable-setuid-sandbox",
            // Windows下--single-process支持存在问题
            util.isLinux() ? "--single-process" : "--process-per-tab",
            // 如果共享内存/dev/shm比较小，可能导致浏览器无法启动，可以禁用它
            ...(this.disableDevShm ? ["--disable-dev-shm-usage"] : []),
            // 禁用扩展程序
            "--disable-extensions",
            // 隐藏滚动条
            "--hide-scrollbars",
            // 静音
            "--mute-audio",
            // 禁用Web安全策略
            "--disable-web-security",
            // 禁用小恐龙彩蛋
            "--disable-dinosaur-easter-egg",
            // 禁用IPC泛洪保护
            "--disable-ipc-flooding-protection",
            // 禁用降低后台标签页优先级
            "--disable-backgrounding-occluded-windows",
            // 禁用后台标签页定时器节流
            "--disable-background-timer-throttling",
            // 禁用渲染器进程后台化
            "--disable-renderer-backgrounding",
            // 禁用组件更新
            "--disable-component-update",
            // 禁用崩溃报告系统
            "--disable-breakpad",
            // 禁用ping元素
            "--no-pings",
            // 禁用信息栏
            "--disable-infobars",
            // 禁用会话崩溃气泡
            "--disable-session-crashed-bubble",
            // 禁用字形提示以原始轮廓渲染
            "--font-render-hinting=none",
            // 允许在HTTPS页面中加载不安全的HTTP内容
            // "--allow-running-insecure-content",
            // 禁用默认浏览器检查
            "--no-default-browser-check",
            // 禁用弹窗
            "--block-new-web-contents",
            // 禁用错误对话框
            "--noerrdialogs",
            // 启用平滑滚动
            "--enable-smooth-scrolling",
            // 启用确定性模式
            "--deterministic-mode",
            // 禁用线程动画避免动画不同步
            "--disable-threaded-animation",
            // 禁用线程滚动避免动画不同步
            "--disable-threaded-scrolling",
            // 启用表面同步
            "--enable-surface-synchronization",
            // 强制所有内容完整渲染
            "--disable-new-content-rendering-timeout",
            // 开启beginFrame控制
            "--enable-begin-frame-control",
            // 在呈现所有内容之前防止绘制下一帧
            "--run-all-compositor-stages-before-draw",
            // 是否使用Angle作为渲染后端
            ...(this.useAngle ? ["--use-angle"] : []),
            // 是否使用GPU加速渲染
            ...(this.useGPU ? [
                // 启用GPU
                "--enable-gpu",
                // 启用不安全的WebGPU
                "--enable-unsafe-webgpu",
                // 忽略GPU黑名单，在黑名单的GPU渲染时可能会发生非预期效果
                "--ignore-gpu-blocklist",
                // 图形上下文丢失时不重载页面
                "--gpu-no-context-lost",
                // 启用GPU合成功能
                "--enable-gpu-compositing",
                // 启用GPU栅格化加速绘制
                "--enable-gpu-rasterization",
                // 禁用GPU驱动程序错误处理工作
                // "--disable-gpu-driver-bug-workarounds",
                // 启用GPU内存缓冲区提高图像处理性能
                "--enable-native-gpu-memory-buffers",
                // 启用2D画布加速功能
                "--enable-accelerated-2d-canvas",
                // 启用JPEG解码加速功能
                "--enable-accelerated-jpeg-decoding",
                // 启用MJPEG解码加速功能
                "--enable-accelerated-mjpeg-decode",
                // 启用视频解码加速功能
                "--enable-accelerated-video-decode",
                // 启用零拷贝渲染
                "--enable-zero-copy",
                // 将页面渲染栅格化操作移动到单独的进程中执行
                "--enable-oop-rasterization",
                // 启用GPU内存缓冲区缓存视频帧
                "--enable-gpu-memory-buffer-video-frames",
                // 启用VA-API视频解码器支持、原始绘制支持、Canvas独立进程栅格化、HEVC视频解码器支持
                "--enable-features=VaapiVideoDecoder,RawDraw,CanvasOopRasterization,PlatformHEVCDecoderSupport"
            ] : ["--disable-gpu"]),
            // 其它参数
            ...this.args
        ];
    }

    /**
     * 设置浏览器资源状态
     * 
     * @param {Browser.STATE} state - 浏览器资源状态
     */
    #setState(state) {
        assert(_.isSymbol(state), "state must be Symbol");
        this.state = state;
    }

    /**
     * 是否未初始化
     * 
     * @returns {boolean} - 是否未初始化
     */
    isUninitialized() {
        return this.state == Browser.STATE.UNINITIALIZED;
    }

    /**
     * 是否已就绪
     * 
     * @returns {boolean} - 是否已就绪
     */
    isReady() {
        return this.state == Browser.STATE.READY;
    }

    /**
     * 是否不可用
     * 
     * @returns {boolean} - 是否不可用
     */
    isUnavailabled() {
        return this.state == Browser.STATE.UNAVAILABLED;
    }

    /**
     * 是否已关闭
     * 
     * @returns {boolean} - 是否已关闭
     */
    isClosed() {
        return this.state == Browser.STATE.CLOSED;
    }

    /**
     * 判断页面资源池是否饱和
     * 
     * @returns {boolean} 页面池是否饱和
     */
    isBusy() {
        return this.#pagePool.borrowed >= this.#pagePool.max;
    }

    /**
     * 获取是否首个页面
     * 
     * @returns {boolean} 是否首个页面
     */
    get firstPage() {
        if (!this.#firstPage)
            return false;
        this.#firstPage = false;
        return true;
    }

    /**
     * 获取视频预处理器
     */
    get videoPreprocessor() {
        return this.parent.videoPreprocessor;
    }

}