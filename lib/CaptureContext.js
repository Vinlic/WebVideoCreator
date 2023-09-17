import VideoCanvas from "./VideoCanvas.js";
import DynamicImage from "./DynamicImage.js";
import LottieCanvas from "./LottieCanvas.js";

export default class CaptureContext {

    // 启动时间点（毫秒）
    startupTime = Date.now();
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
    // 配置
    config = {
        // 渲染帧率
        fps: 0,
        // 目标帧率
        frameCount: 0
    };
    // 调度媒体列表
    dispatchMedias = [];

    constructor() {
        // 暂存requestAnimationFrame函数
        window.____requestAnimationFrame = window.requestAnimationFrame;
        // 重写requestAnimationFrame，传递上下文提供的currentTime确保在非60fps捕获时实现帧率同步
        window.requestAnimationFrame = fn => !this.stopFlag && window.____requestAnimationFrame(() => fn(this.currentTime));
        // 暂存Date.now函数
        Date.____now = Date.now;
        // 重写Date.now函数，传递上下文提供的currentTime确保在以系统时间作为时基的动画库实现帧率同步
        Date.now = () => this.startupTime + this.currentTime;
        // 重写Date的getTime原型
        Date.prototype.getTime = Date.now;
    }

    /**
     * 开始捕获
     */
    start() {
        // 更新开始时间
        this.startTime = this.getTime();
        // 计算帧间隔时间
        this.frameInterval = 1000 / this.config.fps;
        // 递归捕获帧
        (function nextFrame() {
            (async () => {
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
                const mediaRenderPromises = this.dispatchMedias.map(media => (async () => {
                    if (media.canDestory(this.currentTime))
                        return media.destory();  //销毁媒体
                    if (!media.canPlay(this.currentTime)) return;  //如媒体不可播放则跳过调度
                    if (!media.isReady()) await media.load();  //媒体未准备完毕时调用加载
                    const mediaCurrentTime = this.currentTime - media.startTime - media.offsetTime;
                    await media.seek(mediaCurrentTime > 0 ? mediaCurrentTime : 0);
                })());
                await Promise.all(mediaRenderPromises);
                // 根据帧间隔推进当前时间
                this.currentTime += this.frameInterval;
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
     * 转换为视频画布
     */
    convertToVideoCanvas(e) {
        const loopAttribute = e.getAttribute("loop");
        const options = {
            src: e.getAttribute("src"),
            width: parseInt(e.style.width || e.getAttribute("width")),
            height: parseInt(e.style.height || e.getAttribute("height")),
            duration: parseInt(e.getAttribute("duration")),
            startTime: parseInt(e.getAttribute("startTime")),
            endTime: parseInt(e.getAttribute("endTime")),
            seekStart: parseInt(e.getAttribute("seekStart")),
            seekEnd: parseInt(e.getAttribute("seekEnd")),
            loop: loopAttribute == "true" ? true : (loopAttribute == "false" ? false : null),
            muted: e.getAttribute("muted") == "true" ? true : false
        };
        const canvas = this.createCanvas(options);
        const videoCanvas = new VideoCanvas(options);
        videoCanvas.bind(canvas);
        e.replaceWith(canvas);
        this.dispatchMedias.push(videoCanvas);
        return videoCanvas;
    }

    /**
     * 创建动态图像
     */
    convertToDynamicImage(e) {
        const loopAttribute = e.getAttribute("loop");
        const options = {
            src: e.getAttribute("src"),
            width: parseInt(e.style.width || e.getAttribute("width")),
            height: parseInt(e.style.height || e.getAttribute("height")),
            startTime: parseInt(e.getAttribute("startTime")),
            endTime: parseInt(e.getAttribute("endTime")),
            loop: loopAttribute == "true" ? true : (loopAttribute == "false" ? false : null),
        };
        const canvas = this.createCanvas(options);
        const dynamicImage = new DynamicImage(options);
        dynamicImage.bind(canvas);
        e.replaceWith(canvas);
        this.dispatchMedias.push(dynamicImage);
        return dynamicImage;
    }

    /**
     * 创建Lottie画布
     */
    convertToLottieCanvas(e) {
        const loopAttribute = e.getAttribute("loop");
        const options = {
            src: e.getAttribute("src"),
            width: parseInt(e.style.width || e.getAttribute("width")),
            height: parseInt(e.style.height || e.getAttribute("height")),
            startTime: parseInt(e.getAttribute("startTime")),
            endTime: parseInt(e.getAttribute("endTime")),
            loop: loopAttribute == "true" ? true : (loopAttribute == "false" ? false : null),
        };
        const canvas = this.createCanvas(options);
        const lottieCanvas = new LottieCanvas(options);
        lottieCanvas.bind(canvas);
        e.replaceWith(canvas);
        this.dispatchMedias.push(lottieCanvas);
        return lottieCanvas;
    }

    /**
     * 获取当前现实时间的时间戳
     * 
     * @returns {number} 时间戳
     */
    getTime() {
        return Date.____now ? Date.____now() : Date.now();
    }

}