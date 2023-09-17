/**
 * Lottie画布
 * 
 * 需依赖lottie-web的canvas版本，请使用script标签加载以下js脚本
 * https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie_canvas.min.js
 */
 class LottieCanvas {

    /** @type {string} - lottie来源 */
    src;
    /** @type {number} - 开始播放时间 */
    startTime;
    /** @type {number} - 结束播放时间 */
    endTime;
    /** @type {boolean} - 是否强制循环 */
    loop;
    /** @type {number} - 帧索引 */
    frameIndex = 0;
    /** @type {number} - 当前播放时间点 */
    currentTime = 0;
    /** @type {HTMLCanvasElement} - 画布元素s */
    canvas = null;
    /** @type {CanvasRenderingContext2D} - 画布2D渲染s上下文 */
    canvasCtx = null;
    /** @type {Object} - Lottie动画对象 */
    animation = null;
    /** @type {boolean} - 是否已销毁 */
    destoryed = false;

    /**
     * 构造函数
     * 
     * @param {Object} options - Lottie动画选项
     * @param {string} options.src - 图像来源
     * @param {number} [options.startTime] - 开始播放时间点（毫秒）
     * @param {number} [options.endTime] - 结束播放时间点（毫秒）
     * @param {boolean} [options.loop] - 是否强制循环
     */
    constructor(options) {
        if (!options)
            throw new Error("LottieCanvas options invalid");
        const { src, startTime, endTime, loop } = options;
        this.src = src;
        this.startTime = startTime || 0;
        this.endTime = endTime || 0;
        this.loop = loop;
    }
    
    /**
     * 绑定画布元素
     * 
     * @param {HTMLCanvasElement} canvas - 画布元素
     * @param {Object} [options] - 画布选项
     * @param {boolean} [options.alpha=true] - 是否支持透明通道
     * @param {boolean} [options.imageSmoothingEnabled=true] - 是否开启抗锯齿
     */
    bind(canvas, options = {}) {
        const { alpha = true, imageSmoothingEnabled = true } = options;
        this.canvas = canvas;
        // 获取画布2D上下文
        this.canvasCtx = this.canvas.getContext("2d", { alpha });
        // 设置抗锯齿开关
        this.canvasCtx.imageSmoothingEnabled = imageSmoothingEnabled;
    }

    /**
     * 判断当前时间点是否可播放
     * 
     * @param {number} time - 时间点
     * @returns {boolean} - 是否可播放
     */
    canPlay(time) {
        // 已销毁不可播放
        if(this.destoryed) return false;
        // 如果当前时间超过元素开始结束时间则判定未不可播放
        const { startTime, endTime } = this;
        if (time < startTime || time >= endTime)
            return false;
        return true;
    }

    /**
     * 加载Lottie
     */
    async load() {
        // 下载Lottie数据
        const response = await fetch(this.src);
        // 获取MIME类型
        let contentType = response.headers.get("Content-Type") || response.headers.get("content-type");
        if(!contentType)
            throw new Error(`lottie Content-Type unknown is not supported`);
        contentType = contentType.split(";")[0];
        // 检查是否为Lottie的json格式
        if(contentType !== "application/json")
            throw new Error(`lottie Content-Type ${contentType} is not supported`);
        // 转换为json对象
        const animationData = await response.json();
        // 调用Lottie动画库加载动画 - 动画库由Page.js注入
        this.animation = lottie.loadAnimation({
            // 是否循环播放动画
            loop: this.loop,
            // 动画JSON数据
            animationData,
            // 使用canvas模式渲染
            renderer: "canvas",
            // 启用自动播放
            autoplay: true,
            // 渲染器设置画布上下文
            rendererSettings: {
                context: this.canvasCtx
            }
        });
    }

    /**
     * 是否准备完毕
     * 
     * @returns {boolean} - 是否准备完毕
     */
    isReady() {
        return !!this.animation;
    }

    /**
     * 索引帧并绘制
     * 
     * @param {number} time - 索引时间点
     */
    async seek(time) {
        this.currentTime = time;
        this.frameIndex++;
    }

    /**
     * 判断是否可销毁
     * 
     * @returns {Boolean}
     */
    canDestory(time) {
        // 已销毁则避免重复销毁
        if(this.destoryed) return false;
        // 返回当前时间是否大于结束实际
        return time >= this.endTime;
    }

    /**
     * 重置Lottie动画
     */
    reset() {
        this.frameIndex = 0;
        this.currentTime = 0;
    }

    /**
     * 销毁Lottie实例
     */
    destory() {
        // 销毁动画对象
        this.animation && this.animation.destroy();
        this.animation = null;
        // 重置动画
        this.reset();
        // 从页面移除画布元素
        this.canvas.remove();
        this.canvas = null;
        this.canvasCtx = null;
        // 设置已销毁
        this.destoryed = true;
    }

}

export default LottieCanvas;