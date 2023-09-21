import VideoCanvas from "../media/VideoCanvas.js";
import DynamicImage from "../media/DynamicImage.js";
import LottieCanvas from "../media/LottieCanvas.js";
import SvgAnimation from "../media/SvgAnimation.js";

export default class CaptureContext {

    // 启动时间点（毫秒）
    startupTime = Math.floor(performance.now());
    // 当前时间点（毫秒）
    currentTime = 0;
    // 当前帧指针
    frameIndex = 0;
    // 帧间隔时间
    frameInterval = 0;
    // 停止标志
    stopFlag = false;
    // 暂停标志
    pauseFlag = false;
    // 恢复回调
    resumeCallback = null;
    // 间隔回调列表
    intervalCallbacks = [];
    // 超时回调列表
    timeoutCallbacks = [];
    // 计时器ID
    timerId = 0;
    // 配置
    config = {
        // 渲染帧率
        fps: 0,
        // 目标帧率
        frameCount: 0
    };
    // 视频选项列表
    videoConfigs = [];
    // 调度媒体列表
    dispatchMedias = [];

    constructor() {
        // 支持获取html元素布尔属性
        HTMLElement.prototype.getBooleanAttribute = function (name) {
            const value = this.getAttribute(name);
            if (value == null) return null;
            return value == "false" ? false : true;
        }
        // 支持获取html元素数字属性
        HTMLElement.prototype.getNumberAttribute = function (name) {
            const value = this.getAttribute(name);
            if (value == null) return null;
            return parseInt(value);
        }
        // 支持获取svg元素数字属性
        SVGSVGElement.prototype.getNumberAttribute = function (name) {
            const value = this.getAttribute(name);
            if (value == null) return null;
            return parseInt(value);
        }
        // 时间虚拟化重写
        this.timeVirtualizationRewrite();
    }

    /**
     * 开始捕获
     */
    start() {
        // 插入捕获辅助元素
        this.insertCaptureHelper();
        // 监听媒体插入
        this.observMediaInsert();
        // 更新开始时间
        this.startTime = Date.now();
        // 计算帧间隔时间
        this.frameInterval = 1000 / this.config.fps;
        // 递归捕获帧
        (function nextFrame() {
            (async () => {

                // 媒体调度
                const mediaRenderPromises = this.dispatchMedias.map(media => (async () => {
                    if (media.canDestory(this.currentTime))
                        return media.destory();  //销毁媒体
                    if (!media.canPlay(this.currentTime)) return;  //如媒体不可播放则跳过调度
                    if (!media.isReady()) await media.load();  //媒体未准备完毕时调用加载
                    const mediaCurrentTime = this.currentTime - media.startTime - (media.offsetTime || 0);
                    await media.seek(mediaCurrentTime > 0 ? mediaCurrentTime : 0);
                })());
                await Promise.all(mediaRenderPromises);
                // 根据帧间隔推进当前时间
                this.currentTime += this.frameInterval;
                // 触发轮询回调列表
                this.callIntervalCallbacks();
                // 触发超时回调列表
                this.callTimeoutCallbacks();

                // 捕获帧图 - 此函数请见Page.js的#envInit的exposeFunction
                if (!await window.captureFrame()) {
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
                    return window.screencastCompleted();
                }

                // 开始捕获下一帧
                nextFrame.bind(this)();
            })()
                .catch(err => console.error(`${err.message}\n${err.stack}`));
        }).bind(this)();
    }

    /**
     * 设置捕获帧率
     * 
     * @param {number} value - 捕获帧率
     */
    setFPS(value) {
        this.config.fps = Number(value);
    }

    /**
     * 设置捕获时长
     * 
     * @param {number} value - 捕获时长（毫秒）
     */
    setDuration(value) {
        this.config.frameCount = Math.floor(value / 1000 * fps);
    }

    /**
     * 设置捕获总帧数
     * 
     * @param {number} value - 捕获总帧数
     */
    setFrameCount(value) {
        this.config.frameCount = value;
    }

    /**
     * 插入捕获辅助元素
     * BeginFrame可能会陷入假死，这个元素会不断旋转确保总是产生新的帧
     */
    insertCaptureHelper() {
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
        document.body.appendChild(captureHelper);
        let rotate = 0;
        (function update() {
            rotate = rotate >= 360 ? 0 : (rotate + 0.1);
            captureHelper.style.transform = `rotate(${rotate}deg)`;
            window.setTimeout(update, 0);
        })();
    }

    observMediaInsert() {
        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
                    for(const addedNode of mutation.addedNodes) {
                        if(addedNode.matches("canvas"))
                            break;
                        else if(addedNode.matches("svg"))
                            this.convertToSvgAnimation(addedNode);
                        else if(addedNode.matches('img[src$=".gif"],img[src$=".webp"],img[src$=".apng"],img[src*=".gif?"],img[src*=".webp?"],img[src*=".apng?"],img[capture]'))
                            this.convertToDynamicImage(addedNode);
                        else if(addedNode.matches('video[src$=".mp4"],video[src$=".webm"],video[src$=".mkv"],video[src*=".mp4?"],video[src*=".webm?"],video[src*=".mkv?"],video[capture]'))
                            this.convertToVideoCanvas(addedNode);
                        else if(addedNode.matches("lottie"))
                            this.convertToLottieCanvas(addedNode);
                    }
                }
            }
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false,
            characterData: false
        });
    }

    /**
     * 时间虚拟化重写
     */
    timeVirtualizationRewrite() {
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
        window.setTimeout = (fn, timeout) => {
            if (typeof fn !== "function")
                throw new TypeError("setTimeout function must be Function");
            if (isNaN(timeout))
                throw new TypeError("setTimeout timeout must be number");
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
            window.____setTimeout(() => fn(this.currentTime), 0);
        };
        // 暂存Date对象
        window.____Date = Date;
        // 重写Date构造函数
        window.Date = (function (timestamp) {
            return new window.____Date(timestamp || this.startupTime + this.currentTime)
        }).bind(this);
        // 重写Date.now函数
        window.Date.now = () => this.startupTime + this.currentTime;
        // 重写performance.now函数
        performance.now = () => Date.now();
    }

    /**
     * 拼接完整URL
     * 
     * @param {string} relativeUrl - 相对URL
     * @returns {string} - 绝对URL
     */
    currentUrlJoin(relativeUrl) {
        if (!relativeUrl || /^(https?:)?\/\//.test(relativeUrl))
            return relativeUrl;
        const currentURL = window.location.href;
        return new URL(relativeUrl, currentURL).href;
    }

    /**
     * 触发轮询函数回调
     */
    callIntervalCallbacks() {
        for (let i = 0; i < this.intervalCallbacks.length; i++) {
            const [timerId, timestamp, interval, fn] = this.intervalCallbacks[i];
            if (this.currentTime < timestamp + interval)
                continue;
            this.intervalCallbacks[i][1] = this.currentTime;
            // 下一个事件循环再调用
            window.____setTimeout(() => fn(this.currentTime), 0);
        }
    }

    /**
     * 触发超时函数回调
     */
    callTimeoutCallbacks() {
        this.timeoutCallbacks = this.timeoutCallbacks.filter(([timerId, timestamp, timeout, fn]) => {
            if (this.currentTime < timestamp + timeout)
                return true;
            // 下一个事件循环再调用
            window.____setTimeout(() => fn(this.currentTime), 0);
            return false;
        });
    }

    /**
     * 创建画布
     */
    createCanvas(options) {
        const { id, width, height } = options;
        const canvas = document.createElement("canvas");
        canvas.id = id;
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
            endTime: e.getNumberAttribute("end-time") || e.getNumberAttribute("endTime")
        };
        // 实例化SVG动画对象
        const svgAnimation = new SvgAnimation(options);
        // 将对象加入媒体调度列表
        this.dispatchMedias.push(svgAnimation);
        return svgAnimation;
    }

    /**
     * 将HTML视频元素转换为视频画布
     * 
     * @param {HTMLVideoElement} e - 视频元素
     */
    convertToVideoCanvas(e) {
        // 获取seek时间
        const currentTimeAttribute = e.getAttribute("currentTime");
        const options = {
            // 视频来源
            src: this.currentUrlJoin(e.getAttribute("src")),
            // 视频宽度
            width: parseInt(e.style.width) || e.getNumberAttribute("width"),
            // 视频高度
            height: parseInt(e.style.height) || e.getNumberAttribute("height"),
            // 视频开始时间点（毫秒）
            startTime: e.getNumberAttribute("start-time") || e.getNumberAttribute("startTime") || this.currentTime,
            // 视频结束时间点（毫秒）
            endTime: e.getNumberAttribute("end-time") || e.getNumberAttribute("endTime"),
            // 视频裁剪开始时间点（毫秒）
            seekStart: e.getNumberAttribute("seek-start") || e.getNumberAttribute("seekStart") || (currentTimeAttribute ? parseInt(currentTimeAttribute) * 1000 : null),
            // 视频裁剪结束时间点（毫秒）
            seekEnd: e.getNumberAttribute("seek-end") || e.getNumberAttribute("seekEnd"),
            // 视频是否自动播放
            autoplay: e.getBooleanAttribute("autoplay"),
            // 视频是否循环播放
            loop: e.getBooleanAttribute("loop"),
            // 视频是否静音
            muted: e.getBooleanAttribute("muted")
        };
        // 创建画布元素
        const canvas = this.createCanvas(options);
        // 实例化视频画布实例
        const videoCanvas = new VideoCanvas(options);
        // 绑定画布元素
        videoCanvas.bind(canvas);
        // 复制目标元素样式
        this.copyElementStyle(e, canvas);
        // 代理目标元素所有属性和行为
        this.buildElementProxy(e, canvas)
        // 将目标元素替换为画布
        e.replaceWith(canvas);
        // 添加到视频配置列表
        this.videoConfigs.push({
            target: videoCanvas,
            url: options.src,
            ...options
        });
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
            // 图像来源
            src: this.currentUrlJoin(e.getAttribute("src")),
            // 图像宽度
            width: parseInt(e.style.width) || e.getNumberAttribute("width") || e.width,
            // 图像高度
            height: parseInt(e.style.height) || e.getNumberAttribute("height") || e.height,
            // 图像播放开始时间点（毫秒）
            startTime: e.getNumberAttribute("start-time") || e.getNumberAttribute("startTime") || this.currentTime,
            // 图像播放结束时间点（毫秒）
            endTime: e.getNumberAttribute("end-time") || e.getNumberAttribute("endTime"),
            // 是否循环播放
            loop: e.getBooleanAttribute("loop"),
            // 拉取失败时重试拉取次数
            retryFetchs: e.getNumberAttribute("retry-fetchs") || e.getNumberAttribute("retryFetchs")
        };
        // 创建画布元素
        const canvas = this.createCanvas(options);
        // 实例化动态图像实例
        const dynamicImage = new DynamicImage(options);
        // 绑定画布元素
        dynamicImage.bind(canvas);
        // 复制目标元素样式
        this.copyElementStyle(e, canvas);
        // 代理目标元素所有属性和行为
        this.buildElementProxy(e, canvas);
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
            // lottie来源
            src: this.currentUrlJoin(e.getAttribute("src")),
            // 动画宽度
            width: parseInt(e.style.width) || e.getNumberAttribute("width"),
            // 动画宽度
            height: parseInt(e.style.height) || e.getNumberAttribute("height"),
            // 动画播放开始时间点（毫秒）
            startTime: e.getNumberAttribute("start-time") || e.getNumberAttribute("startTime") || this.currentTime,
            // 动画播放结束时间点（毫秒）
            endTime: e.getNumberAttribute("end-time") || e.getNumberAttribute("endTime"),
            // 是否循环播放
            loop: e.getBooleanAttribute("loop"),
            // 拉取失败时重试拉取次数
            retryFetchs: e.getNumberAttribute("retry-fetchs") || e.getNumberAttribute("retryFetchs")
        };
        // 创建画布元素
        const canvas = this.createCanvas(options);
        // 实例化Lottie动画实例
        const lottieCanvas = new LottieCanvas(options);
        // 绑定画布元素
        lottieCanvas.bind(canvas);
        // 复制目标元素样式
        this.copyElementStyle(e, canvas);
        // 代理目标元素所有属性和行为
        this.buildElementProxy(e, canvas)
        // 将目标元素替换为画布
        e.replaceWith(canvas);
        // 将对象加入媒体调度列表
        this.dispatchMedias.push(lottieCanvas);
        return lottieCanvas;
    }

    /**
     * 复制元素样式
     * 
    * @param {HTMLElement} - 被复制HTML元素
     * @param {HTMLElement} - 新元素
     */
    copyElementStyle(src, dest) {
        for (var i = 0; i < src.style.length; i++) {
            var property = src.style[i];
            var value = src.style.getPropertyValue(property);
            dest.style.setProperty(property, value);
        }
    }

    /**
     * 建立元素代理
     * 将对旧元素的所有行为代理到新元素
     * 
     * @param {HTMLElement} - 被代理HTML元素
     * @param {HTMLElement} - 新元素
     */
    buildElementProxy(src, dest) {
        // 监听元素
        Object.defineProperties(src, {
            textContent: { get: () => dest.textContent, set: v => dest.textContent = v },
            innerHTML: { get: () => dest.innerHTML, set: v => dest.innerHTML = v },
            innerText: { get: () => dest.innerText, set: v => dest.innerText = v },
            setHTML: { get: () => dest.setHTML, set: v => dest.setHTML = v },
            getInnerHTML: { get: () => dest.getInnerHTML, set: v => dest.getInnerHTML = v },
            getRootNode: { get: () => dest.getRootNode, set: v => dest.getRootNode = v },
            value: { get: () => dest.value, set: v => dest.value = v },
            style: { get: () => dest.style, set: v => dest.style = v },
            src: { get: () => dest.src, set: v => dest.src = v },
            classList: { get: () => dest.classList, set: v => dest.classList = v },
            className: { get: () => dest.className, set: v => dest.className = v },
            hidden: { get: () => dest.hidden, set: v => dest.hidden = v },
            animate: { get: () => dest.animate, set: v => dest.animate = v },
            attributes: { get: () => dest.attributes, set: v => dest.attributes = v },
            childNodes: { get: () => dest.childNodes, set: v => dest.childNodes = v },
            children: { get: () => dest.children, set: v => dest.children = v },
            addEventListener: { get: () => dest.addEventListener, set: v => dest.addEventListener = v },
            removeEventListener: { get: () => dest.removeEventListener, set: v => dest.removeEventListener = v },
            append: { get: () => dest.append, set: v => dest.append = v },
            appendChild: { get: () => dest.appendChild, set: v => dest.appendChild = v },
            prepend: { get: () => dest.prepend, set: v => dest.prepend = v },
            replaceChild: { get: () => dest.replaceChild, set: v => dest.replaceChild = v },
            replaceChildren: { get: () => dest.replaceChildren, set: v => dest.replaceChildren = v },
            removeChild: { get: () => dest.removeChild, set: v => dest.removeChild = v },
            blur: { get: () => dest.blur, set: v => dest.blur = v },
            title: { get: () => dest.title, set: v => dest.title = v },
            toString: { get: () => dest.toString, set: v => dest.toString = v },
            autofocus: { get: () => dest.autofocus, set: v => dest.autofocus = v },
            parentElement: { get: () => dest.parentElement, set: v => dest.parentElement = v },
            parentNode: { get: () => dest.parentNode, set: v => dest.parentNode = v },
            clientWidth: { get: () => dest.clientWidth, set: v => dest.clientWidth = v },
            clientHeight: { get: () => dest.clientHeight, set: v => dest.clientHeight = v },
            clientTop: { get: () => dest.clientTop, set: v => dest.clientTop = v },
            clientLeft: { get: () => dest.clientLeft, set: v => dest.clientLeft = v },
            removeAttribute: { get: () => dest.removeAttribute, set: v => dest.removeAttribute = v },
            removeAttributeNode: { get: () => dest.removeAttributeNode, set: v => dest.removeAttributeNode = v },
            removeAttributeNS: { get: () => dest.removeAttributeNS, set: v => dest.removeAttributeNS = v },
            setAttribute: { get: () => dest.setAttribute, set: v => dest.setAttribute = v },
            setAttributeNS: { get: () => dest.setAttributeNS, set: v => dest.setAttributeNS = v },
            setAttributeNode: { get: () => dest.setAttributeNode, set: v => dest.setAttributeNode = v },
            setAttributeNodeNS: { get: () => dest.setAttributeNodeNS, set: v => dest.setAttributeNodeNS = v },
            getAttributeNames: { get: () => dest.getAttributeNames, set: v => dest.getAttributeNames = v },
            getAttribute: { get: () => dest.getAttribute, set: v => dest.getAttribute = v },
            getAttributeNS: { get: () => dest.getAttributeNS, set: v => dest.getAttributeNS = v },
            getAttributeNode: { get: () => dest.getAttributeNode, set: v => dest.getAttributeNode = v },
            getAttributeNodeNS: { get: () => dest.getAttributeNodeNS, set: v => dest.getAttributeNodeNS = v },
            hasAttribute: { get: () => dest.hasAttribute, set: v => dest.hasAttribute = v },
            hasAttributeNS: { get: () => dest.hasAttributeNS, set: v => dest.hasAttributeNS = v },
            hasAttributes: { get: () => dest.hasAttributes, set: v => dest.hasAttributes = v },
            hasChildNodes: { get: () => dest.hasChildNodes, set: v => dest.hasChildNodes = v },
            hasOwnProperty: { get: () => dest.hasOwnProperty, set: v => dest.hasOwnProperty = v },
            offsetParent: { get: () => dest.offsetParent, set: v => dest.offsetParent = v },
            offsetTop: { get: () => dest.offsetTop, set: v => dest.offsetTop = v },
            offsetLeft: { get: () => dest.offsetLeft, set: v => dest.offsetLeft = v },
            offsetWidth: { get: () => dest.offsetWidth, set: v => dest.offsetWidth = v },
            offsetHeight: { get: () => dest.offsetHeight, set: v => dest.offsetHeight = v },
            hasChildNodes: { get: () => dest.hasChildNodes, set: v => dest.hasChildNodes = v },
            getAnimations: { get: () => dest.getAnimations, set: v => dest.getAnimations = v },
            scroll: { get: () => dest.scroll, set: v => dest.scroll = v },
            scrollBy: { get: () => dest.scrollBy, set: v => dest.scrollBy = v },
            scrollIntoView: { get: () => dest.scrollIntoView, set: v => dest.scrollIntoView = v },
            scrollIntoViewIfNeeded: { get: () => dest.scrollIntoViewIfNeeded, set: v => dest.scrollIntoViewIfNeeded = v },
            scrollTop: { get: () => dest.scrollTop, set: v => dest.scrollTop = v },
            scrollLeft: { get: () => dest.scrollLeft, set: v => dest.scrollLeft = v },
            scrollWidth: { get: () => dest.scrollWidth, set: v => dest.scrollWidth = v },
            scrollHeight: { get: () => dest.scrollHeight, set: v => dest.scrollHeight = v },
            dataset: { get: () => dest.dataset, set: v => dest.dataset = v },
            insert: { get: () => dest.insert, set: v => dest.insert = v },
            insertBefore: { get: () => dest.insertBefore, set: v => dest.insertBefore = v },
            before: { get: () => dest.before, set: v => dest.before = v },
            firstChild: { get: () => dest.firstChild, set: v => dest.firstChild = v },
            firstElementChild: { get: () => dest.firstElementChild, set: v => dest.firstElementChild = v },
            lastChild: { get: () => dest.lastChild, set: v => dest.lastChild = v },
            lastElementChild: { get: () => dest.lastElementChild, set: v => dest.lastElementChild = v },
            closest: { get: () => dest.closest, set: v => dest.closest = v },
            valueOf: { get: () => dest.valueOf, set: v => dest.valueOf = v },
            click: { get: () => dest.click, set: v => dest.click = v },
            cloneNode: { get: () => dest.cloneNode, set: v => dest.cloneNode = v },
            nodeName: { get: () => dest.nodeName, set: v => dest.nodeName = v },
            nodeType: { get: () => dest.nodeType, set: v => dest.nodeType = v },
            nodeValue: { get: () => dest.nodeValue, set: v => dest.nodeValue = v },
            normalize: { get: () => dest.normalize, set: v => dest.normalize = v },
            matches: { get: () => dest.matches, set: v => dest.matches = v }
        });
    }

    /**
     * 拉取响应
     * 
     * @param {string} url - 拉取URL
     * @param {number} [retryCount=2] - 重试次数
     * @returns {Response} - 响应对象
     */
    async fetch(url, retryCount = 2, _retryIndex = 0) {
        return await new Promise((resolve, reject) => {
            fetch(url)
                .then(response => {
                    if (response.status >= 400)
                        throw new Error(`Fetch ${url} response error: [${response.status}] ${response.statusText}`);
                    else
                        resolve(response);
                })
                .catch(err => {
                    if (_retryIndex >= retryCount)
                        reject(err);
                    else
                        this.fetch(url, retryCount, _retryIndex + 1);
                });
        });
    }

}