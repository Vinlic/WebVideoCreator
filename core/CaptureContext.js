import ____SvgAnimation from "../media/SvgAnimation.js";
import ____VideoCanvas from "../media/VideoCanvas.js";
import ____DynamicImage from "../media/DynamicImage.js";
import ____LottieCanvas from "../media/LottieCanvas.js";

export default class CaptureContext {

    /** 媒体选择器 */
    SVG_SELECTOR = "svg";
    AUDIO_SELECTOR = 'audio[src$=".mp3"],audio[src$=".ogg"],audio[src$=".acc"],audio[src*=".mp3?"],audio[src*=".ogg?"],audio[src*=".aac?"],audio[capture]';
    VIDEO_SELECTOR = 'video[src$=".mp4"],video[src$=".webm"],video[src$=".mkv"],video[src*=".mp4?"],video[src*=".webm?"],video[src*=".mkv?"],video[capture]';
    DYNAMIC_IMAGE_SELECTOR = 'img[src$=".gif"],img[src$=".webp"],img[src$=".apng"],img[src*=".gif?"],img[src*=".webp?"],img[src*=".apng?"],img[capture]';
    LOTTIE_SELECTOR = "lottie";

    /** @type {number} - 启动时间点（毫秒） */
    startTime = Date.now();
    /** @type {number} - 当前时间点（毫秒） */
    currentTime = 0;
    /** @type {number} - 当前帧指针 */
    frameIndex = 0;
    /** @type {number} - 帧间隔时间（毫秒） */
    frameInterval = 0;
    /** @type {boolean} - 准备完毕标志 */
    readyFlag = false;
    /** @type {boolean} - 停止标志 */
    stopFlag = false;
    /** @type {boolean} - 暂停标志 */
    pauseFlag = false;
    /** @type {Function} - 准备完毕回调 */
    readyCallback;
    /** @type {Function} - 恢复回调 */
    resumeCallback = null;
    /** @type {Function[]} - 间隔回调列表 */
    intervalCallbacks = [];
    /** @type {Function[]} - 超时回调列表 */
    timeoutCallbacks = [];
    /** @type {number} - 计时器自增ID */
    timerId = 0;
    /** @type {number} - 自增音频ID */
    audioId = 0;
    /** @type {number} - 应用于Date对象的时间偏移HACK（处理mojs动画） */
    timeOffset = 0;
    /** @type {Object} - 配置对象 */
    config = {
        /** @type {number} - 渲染帧率 */
        fps: null,
        /** @type {number} - 总时长 */
        duration: null,
        /** @type {number} - 目标总帧数 */
        frameCount: null
    };
    /** @type {SvgAnimation[]|VideoCanvas[]|DynamicImage[]|LottieCanvas[]} - 媒体调度列表 */
    dispatchMedias = [];

    /**
     * 构造函数
     */
    constructor() {
        // 控制台输出重写
        this._consoleRewrite();
        // 元素行为重写
        this._elementRewrite();
        // 时间虚拟化重写
        this._timeVirtualizationRewrite();
    }

    /**
     * 准备完毕
     * 
     * @return {boolean} - 是否已启动
     */
    ready() {
        // 设置准备完毕标志为true
        this.readyFlag = true;
        // 如果存在准备前的启动则调用
        if (this.readyCallback) {
            this.readyCallback();
            return true;
        }
        return false;
    }

    /**
     * 开始捕获
     */
    start() {
        // 如果在准备完毕前启动则延迟到准备完毕再启动
        if (!this.readyFlag) {
            this.readyCallback = this.start;
            return;
        }
        // 检查配置
        this._checkConfig();
        // 插入捕获辅助元素
        this._insertCaptureHelper();
        // 转换元素为媒体元素
        this._convertElementsToMedias();
        // 监听媒体插入
        this._observMediaInsert();
        // 更新开始时间
        this.startTime = Date.now();
        // 计算帧间隔时间
        this.frameInterval = 1000 / this.config.fps;
        // 递归捕获帧
        (function nextFrame() {
            (async () => {
                // 如果已停止则跳出
                if(this.stopFlag)
                    return;
                // 媒体调度
                const mediaRenderPromises = this.dispatchMedias.map(media => (async () => {
                    // 媒体可销毁时执行销毁
                    if (media.canDestory(this.currentTime))
                        return media.destory();
                    // 如媒体不可播放则跳过调度
                    if (!media.canPlay(this.currentTime))
                        return;
                    // 媒体未准备完毕时调用加载
                    if (!media.isReady()) {
                        // 加载媒体，如加载失败则跳过
                        if (!await media.load())
                            return;
                    };
                    const mediaCurrentTime = this.currentTime - media.startTime - (media.offsetTime || 0);
                    await media.seek(mediaCurrentTime > 0 ? mediaCurrentTime : 0);
                })());
                await Promise.all(mediaRenderPromises);
                // 根据帧间隔推进当前时间
                this.currentTime += this.frameInterval;
                // 时间偏移HACK重置（处理mojs动画）
                this.timeOffset = 0;
                // 触发轮询回调列表
                this._callIntervalCallbacks();
                // 触发超时回调列表
                this._callTimeoutCallbacks();

                // 捕获帧图 - 此函数请见Page.js的#envInit的exposeFunction
                if (!await ____captureFrame(this.currentTime)) {
                    this.stopFlag = true;
                    return;
                }

                // 遇到暂停标志时等待恢复
                if (this.pauseFlag)
                    await new Promise(resolve => this.resumeCallback = resolve);
                // 捕获帧数到达目标帧数时终止捕获
                if (++this.frameIndex >= this.config.frameCount) {
                    this.stopFlag = true;
                    // 完成录制回调 - 此函数请见Page.js的#envInit的exposeFunction
                    return ____screencastCompleted();
                }
                // 如果未到达目标帧数但已被停止也触发录制完成
                else if(this.stopFlag)
                    return ____screencastCompleted();

                // 开始捕获下一帧
                nextFrame.bind(this)();
            })()
                .catch(err => console.error(err));
        }).bind(this)();
    }

    /**
     * 检查配置
     */
    _checkConfig() {
        const { fps, duration, frameCount } = this.config;
        if (isNaN(fps) || fps <= 0)
            throw new Error(`config fps ${fps} is invalid`);
        if (isNaN(duration) || duration <= 0)
            throw new Error(`config duration ${duration} is invalid`);
        if (isNaN(frameCount) || frameCount <= 0)
            throw new Error(`config frameCount ${frameCount} is invalid`);
    }

    /**
     * 插入捕获辅助元素
     * BeginFrame可能会陷入假死，这个元素会不断旋转确保总是产生新的帧
     */
    _insertCaptureHelper() {
        const captureHelper = document.createElement("capture-helper");
        // 设置几乎看不见的样式
        Object.assign(captureHelper.style, {
            width: "0.1px",
            height: "0.1px",
            opacity: 0.1,
            position: "fixed",
            top: 0,
            left: 0,
            zIndex: 999,
            backgroundColor: "#fff",
            transform: "rotate(0deg)"
        });
        // 加入到body中
        (document.body || document).appendChild(captureHelper);
        let rotate = 0;
        (function update() {
            rotate = rotate >= 360 ? 0 : (rotate + 0.1);
            captureHelper.style.transform = `rotate(${rotate}deg)`;
            setTimeout(update, 0);
        })();
    }

    /**
     * 转换元素为媒体对象
     * 
     * @private
     */
    _convertElementsToMedias() {
        const svgs = document.querySelectorAll(this.SVG_SELECTOR);
        const audios = document.querySelectorAll(this.AUDIO_SELECTOR);
        const videos = document.querySelectorAll(this.VIDEO_SELECTOR);
        const dynamicImages = document.querySelectorAll(this.DYNAMIC_IMAGE_SELECTOR);
        const lotties = document.querySelectorAll(this.LOTTIE_SELECTOR);
        svgs.forEach(e => captureCtx.convertToSvgAnimation(e));
        audios.forEach(e => captureCtx.convertToInnerAudio(e));
        videos.forEach(e => captureCtx.convertToVideoCanvas(e));
        dynamicImages.forEach(e => captureCtx.convertToDynamicImage(e));
        lotties.forEach(e => captureCtx.convertToLottieCanvas(e));
    }

    /**
     * 监听媒体插入
     * 
     * @private
     */
    _observMediaInsert() {
        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                if (mutation.type === "childList") {
                    if (mutation.addedNodes.length > 0) {
                        for (const addedNode of mutation.addedNodes) {
                            if (!addedNode.matches)
                                return;
                            if (addedNode.matches("canvas"))
                                break;
                            else if (addedNode.matches(this.SVG_SELECTOR))
                                this.convertToSvgAnimation(addedNode);
                            else if (addedNode.matches(this.DYNAMIC_IMAGE_SELECTOR))
                                this.convertToDynamicImage(addedNode);
                            else if (addedNode.matches(this.AUDIO_SELECTOR))
                                this.convertToInnerAudio(addedNode);
                            else if (addedNode.matches(this.VIDEO_SELECTOR))
                                this.convertToVideoCanvas(addedNode);
                            else if (addedNode.matches(this.LOTTIE_SELECTOR))
                                this.convertToLottieCanvas(addedNode);
                        }
                    }
                    if (mutation.removedNodes.length > 0) {
                        for (const removedNode of mutation.removedNodes) {
                            // 通知节点移除
                            removedNode.____onRemoved && removedNode.____onRemoved();
                        }
                    }
                }
            }
        });
        observer.observe(document.body || document, {
            childList: true,
            subtree: true,
            attributes: false,
            characterData: false
        });
    }

    /**
     * 控制台输出重写
     */
    _consoleRewrite() {
        const getPrintFun = fn => ((...args) =>
            fn.bind(console)(args.reduce((t, v) => {
                if (v instanceof Error)
                    return `${t}\n${v.stack} `;
                else if (v instanceof Object)
                    return `${t}${JSON.stringify(v)} `;
                return `${t}${v} `;
            }, "")));
        console.____log = console.log;
        console.log = getPrintFun(console.____log);
        console.____warn = console.warn;
        console.warn = getPrintFun(console.____warn);
        console.____error = console.error;
        console.error = getPrintFun(console.____error);
        console.____debug = console.debug;
        console.debug = getPrintFun(console.____debug);
    }

    /**
     * 元素行为重写
     */
    _elementRewrite() {
        // 支持获取html元素布尔属性
        HTMLElement.prototype.getBooleanAttribute = function (name) {
            const value = this.getAttribute(name);
            if (value == null) return undefined;
            return value == "false" ? false : true;
        }
        // 支持获取html元素数字属性
        HTMLElement.prototype.getNumberAttribute = function (name) {
            const value = this.getAttribute(name);
            if (value == null) return undefined;
            return Number(value);
        }
        // 支持获取svg元素数字属性
        SVGSVGElement.prototype.getNumberAttribute = function (name) {
            const value = this.getAttribute(name);
            if (value == null) return undefined;
            return Number(value);
        }
    }

    /**
     * 时间虚拟化重写
     * 
     * @private
     */
    _timeVirtualizationRewrite() {
        // 暂存setInterval函数
        window.____setInterval = window.setInterval;
        // 重写setInterval函数
        window.setInterval = (fn, interval) => {
            if (typeof fn !== "function")
                throw new TypeError("setInterval function must be Function");
            if (isNaN(interval))
                throw new TypeError("setInterval interval must be number");
            this.timerId++;
            this.intervalCallbacks.push([this.timerId, this.currentTime, interval, fn]);
            return this.timerId;
        };
        // 暂存clearInterval函数
        window.____clearInterval = window.clearInterval;
        // 重写cleanInterval函数
        window.clearInterval = timerId => {
            if (!timerId) return;
            this.intervalCallbacks = this.intervalCallbacks.filter(([_timerId]) => {
                if (_timerId == timerId)
                    return false;
                return true;
            });
        }
        // 暂存setTimeout函数
        window.____setTimeout = window.setTimeout;
        // 重写setTimeout函数
        window.setTimeout = (fn, timeout = 0) => {
            if (typeof fn !== "function")
                throw new TypeError("setTimeout function must be Function");
            this.timerId++;
            this.timeoutCallbacks.push([this.timerId, this.currentTime, timeout, fn]);
            return this.timerId;
        };
        // 暂存clearTimeout函数
        window.____clearTimeout = window.clearTimeout;
        // 重写clearTimeout函数
        window.clearTimeout = timerId => {
            if (!timerId) return;
            this.timeoutCallbacks = this.timeoutCallbacks.filter(([_timerId]) => {
                if (_timerId == timerId)
                    return false;
                return true;
            });
        }
        // 暂存requestAnimationFrame函数
        window.____requestAnimationFrame = window.requestAnimationFrame;
        // 重写requestAnimationFrame，传递上下文提供的currentTime确保在非60fps捕获时实现帧率同步
        window.requestAnimationFrame = fn => {
            if (this.stopFlag)
                return;
            // 下一个事件循环再调用
            window.____requestAnimationFrame(() => fn(this.currentTime));
        };
        // 暂存Date对象
        window.____Date = Date;
        const ctx = this;
        // 重写Date构造函数
        window.Date = function Date(...args) {
            if (new.target === undefined)
                return new window.____Date(ctx.startTime + ctx.currentTime).toString();
            if (args.length === 0)
                return new window.____Date(ctx.startTime + ctx.currentTime);
            return new window.____Date(...args);
        }
        // 将挂载的函数
        Object.assign(window.Date, {
            prototype: window.____Date.prototype,
            now: () => Math.floor(this.startTime + this.currentTime) + (this.timeOffset += 0.01),
            parse: window.____Date.parse.bind(window.____Date),
            UTC: window.____Date.UTC.bind(window.____Date)
        });
        // 重写performance.now函数
        performance.now = () => this.currentTime;
    }

    /**
     * 拼接完整URL
     * 
     * @private
     * @param {string} relativeUrl - 相对URL
     * @returns {string} - 绝对URL
     */
    _currentUrlJoin(relativeUrl) {
        if (!relativeUrl || /^(https?:)?\/\//.test(relativeUrl))
            return relativeUrl;
        const currentURL = window.location.href;
        return new URL(relativeUrl, currentURL).href;
    }

    /**
     * 触发轮询函数回调
     * 
     * @private
     */
    _callIntervalCallbacks() {
        for (let i = 0; i < this.intervalCallbacks.length; i++) {
            const [timerId, timestamp, interval, fn] = this.intervalCallbacks[i];
            if (this.currentTime < timestamp + interval)
                continue;
            this.intervalCallbacks[i][1] = this.currentTime;
            // 下一个事件循环再调用
            ____setTimeout(() => fn(this.currentTime), 0);
        }
    }

    /**
     * 触发超时函数回调
     * 
     * @private
     */
    _callTimeoutCallbacks() {
        this.timeoutCallbacks = this.timeoutCallbacks.filter(([timerId, timestamp, timeout, fn]) => {
            if (this.currentTime < timestamp + timeout)
                return true;
            // 下一个事件循环再调用
            ____setTimeout(() => fn(this.currentTime), 0);
            return false;
        });
    }

    /**
     * 创建画布
     * 
     * @private
     */
    _createCanvas(options) {
        const { id, class: _class, width, height } = options;
        const canvas = document.createElement("canvas");
        id && canvas.setAttribute("id", id);
        _class && canvas.setAttribute("class", _class);
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }

    /**
     * 转化为SVG动画对象
     * 
     * @param {SVGSVGElement} e - SVG元素
     */
    convertToSvgAnimation(e) {
        const hasAnimation = e.querySelector("animate, animateTransform, animateMotion, animateColor");
        // 未找到任何动画元素则不做处理，这些SVG元素可能是静态的或者由其它动画库控制
        if (!hasAnimation)
            return null;
        const options = {
            // SVG元素
            target: e,
            // 动画播放开始时间点（毫秒）
            startTime: e.getNumberAttribute("start-time") || e.getNumberAttribute("startTime") || this.currentTime,
            // 动画播放结束时间点（毫秒）
            endTime: Math.min(e.getNumberAttribute("end-time") || e.getNumberAttribute("endTime") || Infinity, this.config.duration)
        };
        // 实例化SVG动画对象
        const svgAnimation = new ____SvgAnimation(options);
        // 将对象加入媒体调度列表
        this.dispatchMedias.push(svgAnimation);
        return svgAnimation;
    }

    /**
     * 将HTML视频元素转换为内部合成音频
     * 
     * @param {HTMLAudioElement} e - 视频元素
     */
    convertToInnerAudio(e) {
        // 获取seek时间
        const currentTimeAttribute = e.getNumberAttribute("currentTime");
        const audioId = this.audioId++;
        const options = {
            // 内部音频唯一ID
            id: audioId,
            // 音频来源
            url: this._currentUrlJoin(e.getAttribute("_src") || e.getAttribute("src")) || undefined,
            // 音频格式
            format: e.getAttribute("format") || undefined,
            // 音频开始时间点（毫秒）
            startTime: e.getNumberAttribute("start-time") || e.getNumberAttribute("startTime") || this.currentTime,
            // 音频结束时间点（毫秒）
            endTime: Math.min(e.getNumberAttribute("end-time") || e.getNumberAttribute("endTime") || Infinity, this.config.duration),
            // 音频裁剪开始时间点（毫秒）
            seekStart: e.getNumberAttribute("seek-start") || e.getNumberAttribute("seekStart") || (currentTimeAttribute ? currentTimeAttribute * 1000 : undefined),
            // 音频裁剪结束时间点（毫秒）
            seekEnd: e.getNumberAttribute("seek-end") || e.getNumberAttribute("seekEnd"),
            // 音频淡入时长（毫秒）
            fadeInDuration: e.getNumberAttribute("fade-in-duration") || e.getNumberAttribute("fadeInDuration"),
            // 音频淡出时长（毫秒）
            fadeOutDuration: e.getNumberAttribute("fade-out-duration") || e.getNumberAttribute("fadeOutDuration"),
            // 音频音量
            volume: (e.getNumberAttribute("volume") || e.volume || 1) * 100,
            // 音频是否循环播放
            loop: e.getBooleanAttribute("loop"),
            // 音频是否自动播放
            autoplay: e.getBooleanAttribute("autoplay"),
            // 音频是否静音
            muted: e.getBooleanAttribute("muted"),
            // 拉取失败时重试拉取次数
            retryFetchs: e.getNumberAttribute("retry-fetchs") || e.getNumberAttribute("retryFetchs"),
            // 是否忽略本地缓存
            ignoreCache: e.getBooleanAttribute("ignore-cache") || e.getBooleanAttribute("ignoreCache")
        };
        e.____onRemoved = () => ____updateAudioEndTime(audioId, this.currentTime);
        ____addAudio(options);
    }

    /**
     * 将HTML视频元素转换为视频画布
     * 
     * @param {HTMLVideoElement} e - 视频元素
     */
    convertToVideoCanvas(e) {
        // 获取seek时间
        const currentTimeAttribute = e.getNumberAttribute("currentTime");
        const options = {
            // 元素ID
            id: e.getAttribute("id") || undefined,
            // 元素类名
            class: e.getAttribute("class") || undefined,
            // 内部音频唯一ID
            audioId: this.audioId++,
            // 视频来源
            url: this._currentUrlJoin(e.getAttribute("_src") || e.getAttribute("src")) || undefined,
            // 蒙版视频来源
            maskUrl: this._currentUrlJoin(e.getAttribute("_maskSrc") || e.getAttribute("maskSrc")) || undefined,
            // 视频格式
            format: e.getAttribute("format") || undefined,
            // 视频宽度
            width: parseInt(e.style.width) || e.getNumberAttribute("width") || e.width,
            // 视频高度
            height: parseInt(e.style.height) || e.getNumberAttribute("height") || e.height,
            // 视频开始时间点（毫秒）
            startTime: e.getNumberAttribute("start-time") || e.getNumberAttribute("startTime") || this.currentTime,
            // 视频结束时间点（毫秒）
            endTime: Math.min(e.getNumberAttribute("end-time") || e.getNumberAttribute("endTime") || Infinity, this.config.duration),
            // 音频淡入时长（毫秒）
            fadeInDuration: e.getNumberAttribute("fade-in-duration") || e.getNumberAttribute("fadeInDuration"),
            // 音频淡出时长（毫秒）
            fadeOutDuration: e.getNumberAttribute("fade-out-duration") || e.getNumberAttribute("fadeOutDuration"),
            // 视频裁剪开始时间点（毫秒）
            seekStart: e.getNumberAttribute("seek-start") || e.getNumberAttribute("seekStart") || (currentTimeAttribute ? currentTimeAttribute * 1000 : undefined),
            // 视频裁剪结束时间点（毫秒）
            seekEnd: e.getNumberAttribute("seek-end") || e.getNumberAttribute("seekEnd"),
            // 视频是否循环播放
            loop: e.getBooleanAttribute("loop"),
            // 视频音频音量
            volume: (e.getNumberAttribute("volume") || e.volume || 1) * 100,
            // 视频是否自动播放
            autoplay: e.getBooleanAttribute("autoplay"),
            // 视频是否静音
            muted: e.getBooleanAttribute("muted"),
            // 拉取失败时重试拉取次数
            retryFetchs: e.getNumberAttribute("retry-fetchs") || e.getNumberAttribute("retryFetchs"),
            // 是否忽略本地缓存
            ignoreCache: e.getBooleanAttribute("ignore-cache") || e.getBooleanAttribute("ignoreCache"),
        };
        // 创建画布元素
        const canvas = this._createCanvas(options);
        // 实例化视频画布实例
        const videoCanvas = new ____VideoCanvas(options);
        // 绑定画布元素
        videoCanvas.bind(canvas);
        // 复制目标元素样式
        this._copyElementStyle(e, canvas);
        // 代理目标元素所有属性和行为
        this._buildElementProxy(e, canvas);
        // 将目标元素替换为画布
        e.replaceWith(canvas);
        // 将对象加入媒体调度列表
        this.dispatchMedias.push(videoCanvas);
        return videoCanvas;
    }

    /**
     * 将HTML图像元素转换为动态图像
     * 
     * @param {HTMLImageElement} e - 图像HTML元素
     */
    convertToDynamicImage(e) {
        const options = {
            // 元素ID
            id: e.getAttribute("id") || undefined,
            // 元素类名
            class: e.getAttribute("class") || undefined,
            // 图像来源
            url: this._currentUrlJoin(e.getAttribute("src")) || undefined,
            // 图像格式
            format: e.getAttribute("format") || undefined,
            // 图像宽度
            width: parseInt(e.style.width) || e.getNumberAttribute("width") || e.width,
            // 图像高度
            height: parseInt(e.style.height) || e.getNumberAttribute("height") || e.height,
            // 图像播放开始时间点（毫秒）
            startTime: e.getNumberAttribute("start-time") || e.getNumberAttribute("startTime") || this.currentTime,
            // 图像播放结束时间点（毫秒）
            endTime: Math.min(e.getNumberAttribute("end-time") || e.getNumberAttribute("endTime") || Infinity, this.config.duration),
            // 是否循环播放
            loop: e.getBooleanAttribute("loop"),
            // 拉取失败时重试拉取次数
            retryFetchs: e.getNumberAttribute("retry-fetchs") || e.getNumberAttribute("retryFetchs")
        };
        // 创建画布元素
        const canvas = this._createCanvas(options);
        // 实例化动态图像实例
        const dynamicImage = new ____DynamicImage(options);
        // 绑定画布元素
        dynamicImage.bind(canvas);
        // 复制目标元素样式
        this._copyElementStyle(e, canvas);
        // 代理目标元素所有属性和行为
        this._buildElementProxy(e, canvas);
        // 将目标元素替换为画布
        e.replaceWith(canvas);
        // 将对象加入媒体调度列表
        this.dispatchMedias.push(dynamicImage);
        return dynamicImage;
    }

    /**
     * 将HTMLLottie元素转换为Lottie画布
     * 
     * @param {HTMLElement} e - LottieHTML元素
     */
    convertToLottieCanvas(e) {
        const options = {
            // 元素ID
            id: e.getAttribute("id") || undefined,
            // 元素类名
            class: e.getAttribute("class") || undefined,
            // lottie来源
            url: this._currentUrlJoin(e.getAttribute("src")) || undefined,
            // 动画宽度
            width: parseInt(e.style.width) || e.getNumberAttribute("width"),
            // 动画宽度
            height: parseInt(e.style.height) || e.getNumberAttribute("height"),
            // 动画播放开始时间点（毫秒）
            startTime: e.getNumberAttribute("start-time") || e.getNumberAttribute("startTime") || this.currentTime,
            // 动画播放结束时间点（毫秒）
            endTime: Math.min(e.getNumberAttribute("end-time") || e.getNumberAttribute("endTime") || Infinity, this.config.duration),
            // 是否循环播放
            loop: e.getBooleanAttribute("loop"),
            // 拉取失败时重试拉取次数
            retryFetchs: e.getNumberAttribute("retry-fetchs") || e.getNumberAttribute("retryFetchs")
        };
        // 创建画布元素
        const canvas = this._createCanvas(options);
        // 实例化Lottie动画实例
        const lottieCanvas = new ____LottieCanvas(options);
        // 绑定画布元素
        lottieCanvas.bind(canvas);
        // 复制目标元素样式
        this._copyElementStyle(e, canvas);
        // 代理目标元素所有属性和行为
        this._buildElementProxy(e, canvas)
        // 将目标元素替换为画布
        e.replaceWith(canvas);
        // 将对象加入媒体调度列表
        this.dispatchMedias.push(lottieCanvas);
        return lottieCanvas;
    }

    /**
     * 复制元素样式
     * 
     * @private
     * @param {HTMLElement} source - 被复制HTML元素
     * @param {HTMLElement} target - 新元素
     */
    _copyElementStyle(source, target) {
        for (var i = 0; i < source.style.length; i++) {
            var property = source.style[i];
            var value = source.style.getPropertyValue(property);
            target.style.setProperty(property, value);
        }
    }

    /**
     * 建立元素代理
     * 将对旧元素的所有行为代理到新元素
     * 
     * @private
     * @param {HTMLElement} source - 被代理HTML元素
     * @param {HTMLElement} target - 新元素
     */
    _buildElementProxy(source, target) {
        // 监听元素
        Object.defineProperties(source, {
            textContent: { get: () => target.textContent, set: v => target.textContent = v },
            innerHTML: { get: () => target.innerHTML, set: v => target.innerHTML = v },
            innerText: { get: () => target.innerText, set: v => target.innerText = v },
            setHTML: { get: () => target.setHTML, set: v => target.setHTML = v },
            getInnerHTML: { get: () => target.getInnerHTML, set: v => target.getInnerHTML = v },
            getRootNode: { get: () => target.getRootNode, set: v => target.getRootNode = v },
            value: { get: () => target.value, set: v => target.value = v },
            style: { get: () => target.style, set: v => target.style = v },
            src: { get: () => target.src, set: v => target.src = v },
            classList: { get: () => target.classList, set: v => target.classList = v },
            className: { get: () => target.className, set: v => target.className = v },
            hidden: { get: () => target.hidden, set: v => target.hidden = v },
            animate: { get: () => target.animate, set: v => target.animate = v },
            attributes: { get: () => target.attributes, set: v => target.attributes = v },
            childNodes: { get: () => target.childNodes, set: v => target.childNodes = v },
            children: { get: () => target.children, set: v => target.children = v },
            addEventListener: { get: () => target.addEventListener, set: v => target.addEventListener = v },
            removeEventListener: { get: () => target.removeEventListener, set: v => target.removeEventListener = v },
            append: { get: () => target.append, set: v => target.append = v },
            appendChild: { get: () => target.appendChild, set: v => target.appendChild = v },
            prepend: { get: () => target.prepend, set: v => target.prepend = v },
            replaceChild: { get: () => target.replaceChild, set: v => target.replaceChild = v },
            replaceChildren: { get: () => target.replaceChildren, set: v => target.replaceChildren = v },
            removeChild: { get: () => target.removeChild, set: v => target.removeChild = v },
            blur: { get: () => target.blur, set: v => target.blur = v },
            title: { get: () => target.title, set: v => target.title = v },
            toString: { get: () => target.toString, set: v => target.toString = v },
            autofocus: { get: () => target.autofocus, set: v => target.autofocus = v },
            parentElement: { get: () => target.parentElement, set: v => target.parentElement = v },
            parentNode: { get: () => target.parentNode, set: v => target.parentNode = v },
            clientWidth: { get: () => target.clientWidth, set: v => target.clientWidth = v },
            clientHeight: { get: () => target.clientHeight, set: v => target.clientHeight = v },
            clientTop: { get: () => target.clientTop, set: v => target.clientTop = v },
            clientLeft: { get: () => target.clientLeft, set: v => target.clientLeft = v },
            removeAttribute: { get: () => target.removeAttribute, set: v => target.removeAttribute = v },
            removeAttributeNode: { get: () => target.removeAttributeNode, set: v => target.removeAttributeNode = v },
            removeAttributeNS: { get: () => target.removeAttributeNS, set: v => target.removeAttributeNS = v },
            setAttribute: { get: () => target.setAttribute, set: v => target.setAttribute = v },
            setAttributeNS: { get: () => target.setAttributeNS, set: v => target.setAttributeNS = v },
            setAttributeNode: { get: () => target.setAttributeNode, set: v => target.setAttributeNode = v },
            setAttributeNodeNS: { get: () => target.setAttributeNodeNS, set: v => target.setAttributeNodeNS = v },
            getAttributeNames: { get: () => target.getAttributeNames, set: v => target.getAttributeNames = v },
            getAttribute: { get: () => target.getAttribute, set: v => target.getAttribute = v },
            getAttributeNS: { get: () => target.getAttributeNS, set: v => target.getAttributeNS = v },
            getAttributeNode: { get: () => target.getAttributeNode, set: v => target.getAttributeNode = v },
            getAttributeNodeNS: { get: () => target.getAttributeNodeNS, set: v => target.getAttributeNodeNS = v },
            hasAttribute: { get: () => target.hasAttribute, set: v => target.hasAttribute = v },
            hasAttributeNS: { get: () => target.hasAttributeNS, set: v => target.hasAttributeNS = v },
            hasAttributes: { get: () => target.hasAttributes, set: v => target.hasAttributes = v },
            hasChildNodes: { get: () => target.hasChildNodes, set: v => target.hasChildNodes = v },
            hasOwnProperty: { get: () => target.hasOwnProperty, set: v => target.hasOwnProperty = v },
            offsetParent: { get: () => target.offsetParent, set: v => target.offsetParent = v },
            offsetTop: { get: () => target.offsetTop, set: v => target.offsetTop = v },
            offsetLeft: { get: () => target.offsetLeft, set: v => target.offsetLeft = v },
            offsetWidth: { get: () => target.offsetWidth, set: v => target.offsetWidth = v },
            offsetHeight: { get: () => target.offsetHeight, set: v => target.offsetHeight = v },
            hasChildNodes: { get: () => target.hasChildNodes, set: v => target.hasChildNodes = v },
            getAnimations: { get: () => target.getAnimations, set: v => target.getAnimations = v },
            scroll: { get: () => target.scroll, set: v => target.scroll = v },
            scrollBy: { get: () => target.scrollBy, set: v => target.scrollBy = v },
            scrollIntoView: { get: () => target.scrollIntoView, set: v => target.scrollIntoView = v },
            scrollIntoViewIfNeeded: { get: () => target.scrollIntoViewIfNeeded, set: v => target.scrollIntoViewIfNeeded = v },
            scrollTop: { get: () => target.scrollTop, set: v => target.scrollTop = v },
            scrollLeft: { get: () => target.scrollLeft, set: v => target.scrollLeft = v },
            scrollWidth: { get: () => target.scrollWidth, set: v => target.scrollWidth = v },
            scrollHeight: { get: () => target.scrollHeight, set: v => target.scrollHeight = v },
            dataset: { get: () => target.dataset, set: v => target.dataset = v },
            insert: { get: () => target.insert, set: v => target.insert = v },
            insertBefore: { get: () => target.insertBefore, set: v => target.insertBefore = v },
            before: { get: () => target.before, set: v => target.before = v },
            firstChild: { get: () => target.firstChild, set: v => target.firstChild = v },
            firstElementChild: { get: () => target.firstElementChild, set: v => target.firstElementChild = v },
            lastChild: { get: () => target.lastChild, set: v => target.lastChild = v },
            lastElementChild: { get: () => target.lastElementChild, set: v => target.lastElementChild = v },
            closest: { get: () => target.closest, set: v => target.closest = v },
            valueOf: { get: () => target.valueOf, set: v => target.valueOf = v },
            click: { get: () => target.click, set: v => target.click = v },
            cloneNode: { get: () => target.cloneNode, set: v => target.cloneNode = v },
            nodeName: { get: () => target.nodeName, set: v => target.nodeName = v },
            nodeType: { get: () => target.nodeType, set: v => target.nodeType = v },
            nodeValue: { get: () => target.nodeValue, set: v => target.nodeValue = v },
            normalize: { get: () => target.normalize, set: v => target.normalize = v },
            matches: { get: () => target.matches, set: v => target.matches = v },
            play: { get: () => () => { } },
            pause: { get: () => () => { } }
        });
        source.remove = () => target.remove();
    }

    /**
     * 拉取响应
     * 
     * @param {string} url - 拉取URL
     * @param {Object} options - 拉取选项
     * @param {number} [options.method="GET"] - 请求方法
     * @param {number} [options.body] - 请求体
     * @param {number} [options.retryFetchs=2] - 重试次数
     * @param {number} [options.retryDelay=500] - 重试延迟
     * @returns {Response} - 响应对象
     */
    async fetch(url, options = {}, _retryIndex = 0) {
        const { retryFetchs = 2, retryDelay = 500, ...fetchOptions } = options;
        return await new Promise((resolve, reject) => {
            fetch(url, fetchOptions)
                .then(async response => {
                    if (response.status >= 500)
                        throw new Error(`Failed to load resource: [${fetchOptions.method || "GET"}] ${response.url} - [${response.status}] ${response.statusText}\n${await response.text()}`);
                    else if (response.status >= 400)
                        resolve(null);
                    else
                        resolve(response);
                })
                .catch(err => {
                    if (_retryIndex >= retryFetchs)
                        reject(err);
                    else
                        ____setTimeout(() => this.fetch(url, options, _retryIndex + 1), retryDelay);
                });
        });
    }

}