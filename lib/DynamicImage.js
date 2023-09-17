/**
 * 动态图像
 */

class DynamicImage {

    /** @type {string} - 动态图像来源 */
    src;
    startTime;  //动态图像开始播放时间
    endTime;  //动态图像结束播放时间
    loop;  //是否强制循环
    frameIndex = 0;  //帧指针
    repetitionIndex = 0;  //重复指针
    currentTime = 0;  //当前播放时间点
    canvas = null;  //绑定的Canvas实例
    canvasCtx = null;  //绑定的Canvas上下文
    canvasRescale = false;  //绑定的Canvas是否已缩放
    offsetTime = 0;  //偏移时间量
    lastFrameTimestamp = null;  //上帧时间戳（毫秒）
    lastFrameDuration = null;  //上帧时长（毫秒）
    errorCallback;  //错误回调
    decoder = null;  //图像解码器
    destoryed = false;  //是否已销毁

    constructor(options) {
        if (!options) throw new Error("DemuxedVideo options invalid");
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
        if(this.destoryed) return;
        const { startTime, endTime } = this;
        if (time < startTime || time >= endTime)
            return false;  //如果当前时间超过元素开始结束时间则判定未不可播放
        return true;
    }

    async load() {
        const response = await fetch(this.src);  //拉取图像
        const contentType = response.headers.get("Content-Type") || response.headers.get("content-type");  //获取图像内容类型
        if(!await ImageDecoder.isTypeSupported(contentType))  //检测图像类型是否支持
            throw new Error(`image type ${contentType} is not supported`);
        this.decoder = new ImageDecoder({
            type: contentType,
            data: response.body
        });
    }

    isReady() {
        return !!this.decoder;
    }

    async seek(time) {
        if(!this.loop && this.isEnd()) return;
        const track = this.getSelectedTrack();  //获取图像轨道
        if(!track) return;  //无可用图像轨道将跳过处理
        //当解码完成且帧指针指向最后一帧时重置帧指针
        if (this.decoder.complete && this.frameIndex >= track.frameCount + 1)
            this.reset();  //重置图像
        //当存在上帧且上帧未完成停留时长前将跳过绘制下一帧
        if(this.lastFrameDuration && time < (this.lastFrameTimestamp + this.lastFrameDuration)) {
            this.currentTime = time;
            return;
        }
        const result = await new Promise((resolve, reject) => {
            this.decoder.decode({ frameIndex: this.frameIndex++ })  //解码该帧图像
            .then(resolve)
            .catch(err => {
                //为效率考虑解码和绘制是同时进行的，如绘制快于解码时可能出现超出帧范围需容错处理
                if (err instanceof RangeError) {
                    this.reset();
                    setTimeout(resolve, 30);  //等待30毫秒后再触发resolve，避免后续疯狂递归
                }
                else
                    reject(err);
            });
        });
        if(!result) return this.seek(time);  //如果因重置未解码任何帧将重新seek
        if(!result.image) return;  //如未解码出任何图像帧将跳过该时间点
        const frame = result.image;
        const { displayWidth, displayHeight } = frame;
        if(!this.canvasRescale) {  //图像比例可能和画布比例不一致，需进行计算缩放
            let renderWidth = this.canvas.width;
            let renderHeight = this.canvas.height;
            const widthScale = this.canvas.width / displayWidth;
            const heightScale = this.canvas.height / displayHeight;
            const width = this.canvas.width * heightScale;
            const height = this.canvas.height * widthScale;
            const scale = Math.max(this.canvas.width / width, this.canvas.height / height);
            renderWidth = width * scale;
            renderHeight = height * scale;
            this.canvas.width = renderWidth;
            this.canvas.height = renderHeight;
            this.canvasRescale = true;
        }
        this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);  //清除上帧画面
        this.canvasCtx.drawImage(frame, 0, 0, displayWidth, displayHeight, 0, 0, this.canvas.width, this.canvas.height);  //绘制图像
        this.lastFrameDuration = frame.duration / 1000;  //记录当前帧时长
        this.lastFrameTimestamp = time;  //记录当前帧时间戳
        this.currentTime = time;  //更新当前时间点
    }

    /**
     * 判断动画是否结束
     * 
     * @returns {Boolean}
     */
    isEnd() {
        const track = this.getSelectedTrack();  //获取图像轨道
        if(!track) return false;  //无可用图像轨道将跳过处理
        if(this.loop === false)
            return this.repetitionIndex >= 1;
        return this.repetitionIndex >= track.repetitionCount + 1;
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
     * 重置图像状态
     */
    reset() {
        this.currentTime = 0;  //播放进度重置
        this.frameIndex = 0;  //帧指针重置
        this.lastFrameTimestamp = null;  //上帧时间戳重置
        this.lastFrameDuration = null;  //上帧时长重置
        this.repetitionIndex++;
    }

    /**
     * 错误回调
     * 
     * @param {Function} callback 
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
        this.decoder && this.decoder.close();
        this.decoder = null;
        this.frameIndex = 0;
        this.currentTime = 0;
        this.canvas.remove();
        this.canvas = null;
        this.canvasCtx = null;
        this.lastFrameTimestamp = null;
        this.lastFrameDuration = null;
        this.destoryed = true;
        console.log("动态图像销毁");
    }

}

export default DynamicImage;