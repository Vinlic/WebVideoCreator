export default class VideoCanvas {

    /** @type {string} - 视频来源 */
    url;
    /** @type {number} - 开始播放时间点（毫秒） */
    startTime;
    /** @type {number} - 结束播放时间（毫秒） */
    endTime;
    /** @type {number} - 裁剪开始时间点（毫秒） */
    seekStart;
    /** @type {number} - 裁剪结束时间点（毫秒） */
    seekEnd;
    /** @type {boolean} - 是否自动播放 */
    autoplay;
    /** @type {boolean} - 是否强制循环 */
    loop;
    /** @type {boolean} - 是否静音 */
    muted;
    /** @type {number} - 重试下载次数 */
    retryFetchs;
    /** @type {number} - 帧索引 */
    frameIndex = 0;
    /** @type {number} - 当前播放时间点（毫秒） */
    currentTime = 0;
    /** @type {boolean} - 是否已销毁 */
    destoryed = false;
    loaded = false;

    constructor(options) {
        if (!options instanceof Object)
            throw new Error("VideoCanvas options must be Object");
        const { url, startTime, endTime, seekStart, seekEnd, autoplay, loop, muted, retryFetchs } = options;
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

    canPlay(time) {
        if (this.destoryed) return;
        const { startTime, endTime } = this;
        if (time < startTime || time >= endTime)
            return false;  //如果当前时间超过元素开始结束时间则判定未不可播放
        return true;
    }

    isReady() {
        return this.loaded;
    }

    async load() {
        // console.error({a: 1}, {b: 1});
        console.time();
        const response = await fetch("video_preprocess", {
            method: "POST",
            body: JSON.stringify(this)
        });
        const buffer = await response.arrayBuffer();
        console.log(buffer.byteLength);
        console.timeEnd();
        this.loaded = true;
    }

    async seek() {

    }

    isEnd() {

    }

    canDestory() {
        return false;
    }

    reset() {

    }

    destory() {

    }


}