/**
 * 动态图像
 */
export default class DynamicImage {

    /** @type {string} - 图像来源 */
    url;
    /** @type {number} - 开始播放时间点（毫秒） */
    startTime;
    /** @type {number} - 结束播放时间（毫秒） */
    endTime;
    /** @type {boolean} - 是否强制循环 */
    loop;
    /** @type {number} - 重试下载次数 */
    retryFetchs;
    /** @type {number} - 帧索引 */
    frameIndex = 0;
    /** @type {number} - 重复索引 */
    repetitionIndex = 0;
    /** @type {number} - 当前播放时间点（毫秒） */
    currentTime = 0;
    /** @type {HTMLCanvasElement} - 画布元素 */
    canvas = null;
    /** @type {CanvasRenderingContext2D}  - 画布2D渲染s上下文*/
    canvasCtx = null;
    /** @type {number} - 上一帧时间戳（毫秒） */
    lastFrameTimestamp = null;
    /** @type {number} - 上一帧时长（毫秒） */
    lastFrameDuration = null;
    /** @type {Function} - 错误回调函数 */
    errorCallback;
    /** @type {ImageDecoder} - 图像解码器 */
    decoder = null;
    /** @type {boolean} - 是否已销毁 */
    destoryed = false;

    /**
     * 构造函数
     * 
     * @param {Object} options - 动态图像选项
     * @param {string} options.url - 图像来源
     * @param {number} [options.startTime=0] - 开始播放时间点（毫秒）
     * @param {number} [options.endTime=Infinity] - 结束播放时间点（毫秒）
     * @param {boolean} [options.loop] - 是否强制循环
     * @param {number} [options.retryFetchs=2] - 重试下载次数
     */
    constructor(options) {
        if (!options instanceof Object)
            throw new Error("DemuxedVideo options must be Object");
        const { url, startTime, endTime, loop, retryFetchs } = options;
        this.url = url;
        this.startTime = startTime || 0;
        this.endTime = endTime || Infinity;
        this.loop = loop;
        this.retryFetchs = retryFetchs || 2;
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
     * 加载图像
     */
    async load() {
        // 下载图像数据
        const response = await window.captureCtx.fetch(this.url, this.retryFetchs);
        // 如果获得null可能响应存在问题，直接销毁对象，具体错误报告由Page.js的响应拦截器处理
        if(!response)
            return this.destory();
        // 获取MIME类型
        let contentType = response.headers.get("Content-Type") || response.headers.get("content-type");
        if(!contentType)
            throw new Error(`image Content-Type unknown is not supported`);
        contentType = contentType.split(";")[0];
        // 检查图像解码器是否是否支持此图像类型
        if(!await ImageDecoder.isTypeSupported(contentType))
            throw new Error(`image type ${contentType} is not supported`);
        // 实例化图像解码器
        this.decoder = new ImageDecoder({
            // MIME类型
            type: contentType,
            // 图像数据
            data: response.body
        });
        // 等待数据完成加载
        await this.decoder.completed;
    }

    /**
     * 是否准备完毕
     * 
     * @returns {boolean} - 是否准备完毕
     */
    isReady() {
        return !!this.decoder;
    }

    /**
     * 索引帧并绘制
     * 
     * @param {number} time - 索引时间点
     */
    async seek(time) {
        if(this.destoryed) return;
        // 如果当前图像不循环且播放结束则不再索引
        if(!this.loop && this.isEnd()) return;
        // 获取图像轨道
        const track = this.getSelectedTrack();
        // 无可用图像轨道将跳过处理
        if(!track) return;
        // 当解码完成且帧索引指向最后一帧时重置帧指针
        if (this.decoder.complete && this.frameIndex >= track.frameCount + 1)
            this.reset();
        // 当存在上一帧且上一帧未完成停留时长前将跳过绘制下一帧，节约重绘频次
        if(time !== 0 && this.lastFrameDuration && time < (this.lastFrameTimestamp + this.lastFrameDuration)) {
            this.currentTime = time;
            return;
        }
        // 等待帧解码
        const result = await new Promise((resolve, reject) => {
            // 解码该帧图像
            this.decoder.decode({ frameIndex: this.frameIndex++ })
            .then(resolve)
            .catch(err => {
                // 为效率考虑解码和绘制是同时进行的，如绘制快于解码时可能出现超出帧范围需容错处理
                if (err instanceof RangeError) {
                    // 重置帧索引
                    this.reset();
                    // 等待30毫秒后再触发resolve，避免后续疯狂递归
                    window.____setTimeout(resolve, 30);
                }
                // 其它错误抛出
                else
                    reject(err);
            });
        });
        // 如果因重置未解码任何帧将重新seek
        if(!result) return this.seek(time);
        // 如未解码出任何图像帧将跳过该时间点
        if(!result.image) return;
        const frame = result.image;
        const { displayWidth, displayHeight } = frame;
        // 清除上一帧画面
        this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        // 绘制当前帧
        this.canvasCtx.drawImage(frame, 0, 0, displayWidth, displayHeight, 0, 0, this.canvas.width, this.canvas.height);
        // 记录当前帧时长
        this.lastFrameDuration = frame.duration / 1000;
        // 记录当前帧时间戳
        this.lastFrameTimestamp = time;
        // 更新当前时间点
        this.currentTime = time;
    }

    /**
     * 判断动画是否已结束
     * 
     * @returns {boolean} - 是否已结束
     */
    isEnd() {
        // 获取图像轨道
        const track = this.getSelectedTrack();
        // 无可用图像轨道将返回已结束
        if(!track) return true;
        // 如果强制不循环将只播放一次
        if(this.loop === false)
            return this.repetitionIndex >= 1;
        // 其它情况遵循文件自身重复次数
        return this.repetitionIndex >= track.repetitionCount + 1;
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
     * 重置图像状态
     */
    reset() {
        // 播放进度重置
        this.currentTime = 0;
        // 帧索引重置
        this.frameIndex = 0;
        // 上一帧时间戳重置
        this.lastFrameTimestamp = null;
        // 上一帧时长重置
        this.lastFrameDuration = null;
        // 重复次数自增1
        this.repetitionIndex++;
    }

    /**
     * 注册错误回调函数
     * 
     * @param {Function} callback - 回调函数
     */
    onError(callback) {
        this.errorCallback = callback;
    }

    /**
     * 获取已选取轨道
     */
    getSelectedTrack() {
        return this.decoder.tracks.selectedTrack;
    }

    /**
     * 销毁动态图像实例
     */
    destory() {
        // 如果解码器存在则先关闭解码器
        this.decoder && this.decoder.close();
        this.decoder = null;
        // 重置图像
        this.reset();
        this.repetitionIndex = 0;
        this.canvas = null;
        this.canvasCtx = null;
        // 设置已销毁
        this.destoryed = true;
    }

}