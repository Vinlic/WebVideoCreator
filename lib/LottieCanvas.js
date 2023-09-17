/**
 * Lottie画布
 */
 class LottieCanvas {

    src;  //Lottie文件来源
    startTime;  //动画开始播放时间
    endTime;  //动画结束播放时间
    loop;  //是否强制循环
    frameIndex = 0;  //帧指针
    currentTime = 0;  //当前播放时间点
    canvas = null;  //绑定的Canvas实例
    canvasCtx = null;  //绑定的Canvas上下文
    offsetTime = 0;  //偏移时间量
    animation = null;  //动画对象
    destoryed = false;  //是否已销毁

    constructor(options) {
        if (!options) throw new Error("LottieCanvas options invalid");
        const { src, startTime, endTime, loop } = options;
        this.src = src;
        this.startTime = startTime || 0;
        this.endTime = endTime || 0;
        this.loop = loop;
    }

    bind(canvas, options = {}) {
        this.canvas = canvas;
        this.canvasCtx = this.canvas.getContext("2d", { alpha: options.alpha || true });
        this.canvasCtx.imageSmoothingEnabled = options.imageSmoothingEnabled || true;  //开启抗锯齿
    }

    canPlay(time) {
        const { startTime, endTime } = this;
        if (time < startTime || time >= endTime)
            return false;  //如果当前时间超过元素开始结束时间则判定未不可播放
        return true;
    }

    async load() {
        const response = await fetch(this.src);  //拉取图像
        let contentType = response.headers.get("Content-Type") || response.headers.get("content-type");
        if(!contentType) return;
        contentType = contentType.split(";")[0];
        if(contentType !== "application/json")  //检测文件类型是否支持
            throw new Error(`lottie type ${contentType} is not supported`);
        const animationData = await response.json();
        this.animation = lottie.loadAnimation({
            loop: this.loop,
            animationData,
            renderer: "canvas",
            autoplay: true,
            rendererSettings: {
                context: this.canvasCtx
            }
        });
    }

    isReady() {
        return !!this.animation;
    }

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
        if(this.destoryed) return false;
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
     * 销毁动态图像实例
     */
    destory() {
        this.animation && this.animation.destroy();
        this.animation = null;
        this.frameIndex = 0;
        this.currentTime = 0;
        this.canvas.remove();
        this.canvas = null;
        this.canvasCtx = null;
        this.destoryed = true;
        console.log("Lottie动画销毁");
    }

}

export default LottieCanvas;