/**
 * SVG动画
 */
export default class SvgAnimation {

    /** @type {number} - 开始时间点（毫秒） */
    startTime;
    /** @type {number} - 结束时间点（毫秒） */
    endTime;
    /** @type {SVGSVGElement} - SVG元素 */
    target;
    /** @type {number} - 重复索引 */
    repetitionIndex = 0;
    /** @type {boolean} - 是否已销毁 */
    destoryed = false;

    /**
     * 构造函数
     * 
     * @param {Object} options - SVG动画选项
     * @param {string} options.target - SVG元素
     * @param {number} [options.startTime=0] - 开始播放时间点（毫秒）
     * @param {number} [options.endTime] - 结束播放时间点（毫秒）
     */
    constructor(options) {
        if (!options instanceof Object)
            throw new Error("SvgAnimation options must be Object");
        const { target, startTime, endTime } = options;
        this.target = target;
        this.startTime = startTime || 0;
        this.endTime = endTime || undefined;
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
        // 如果当前时间超过元素开始结束时间则判定为不可播放
        const { startTime, endTime = Infinity } = this;
        if (time < startTime || time >= endTime)
            return false;
        return true;
    }

    /**
     * 加载动画
     */
    load() {
        // 停止SVG动画播放，后续由内部调度
        this.target.pauseAnimations();
    }

    /**
     * 是否准备完毕
     * 
     * @returns {boolean} - 是否准备完毕
     */
    isReady() {
        // SVG动画已暂停时才可以调度
        return this.target.animationsPaused();
    }

    /**
     * 索引帧并绘制
     * 
     * @param {number} time - 索引时间点
     */
    async seek(time) {
        // 设置SVG动画时间点
        this.target.setCurrentTime(time / 1000);
    }

    /**
     * 判断是否可销毁
     * 
     * @returns {boolean} - 是否可销毁
     */
    canDestory(time) {
        // 已销毁则避免重复销毁
        if(this.destoryed) return false;
        // 返回当前时间是否大于结束时间
        return time >= this.endTime;
    }

    /**
     * 销毁SVG动画
     */
    destory() {
        this.target = null;
        this.destoryed = true;
    }

}