import VideoConfig from "../preprocessor/video/VideoConfig.js";
import ____MP4Demuxer from "./MP4Demuxer.js";
import innerUtil from "../lib/inner-util.js";

const ____util = innerUtil();

/**
 * 视频画布
 */
export default class VideoCanvas {

    /** @type {string} - 视频URL */
    url;
    /** @type {string} - 蒙版视频URL */
    maskUrl;
    /** @type {string} - 视频格式 */
    format;
    /** @type {number} - 开始播放时间点（毫秒） */
    startTime;
    /** @type {number} - 结束播放时间（毫秒） */
    endTime;
    /** @type {number} - 内部音频ID */
    audioId;
    /** @type {number} - 裁剪开始时间点（毫秒） */
    seekStart;
    /** @type {number} - 裁剪结束时间点（毫秒） */
    seekEnd;
    /** @type {number} - 视频音频淡入时长（毫秒） */
    fadeInDuration;
    /** @type {number} - 视频音频淡出时长（毫秒） */
    fadeOutDuration;
    /** @type {boolean} - 是否强制循环 */
    loop;
    /** @type {number} - 视频音频音量 */
    volume;
    /** @type {boolean} - 是否自动播放 */
    autoplay;
    /** @type {boolean} - 是否静音 */
    muted;
    /** @type {number} - 重试下载次数 */
    retryFetchs;
    /** @type {boolean} - 是否忽略本地缓存 */
    ignoreCache;
    /** @type {Object} - 视频信息配置对象 */
    config;
    /** @type {Uint8Array} - 视频数据 */
    buffer = null;
    /** @type {Uint8Array} - 蒙版视频数据 */
    maskBuffer = null;
    /** @type {number} - 帧索引 */
    frameIndex = null;
    /** @type {number} - 已解码帧索引 */
    decodedFrameIndex = 0;
    /** @type {number} - 已解码蒙版帧索引 */
    decodedMaskFrameIndex = 0;
    /** @type {number} - 当前播放时间点（毫秒） */
    currentTime = 0;
    /** @type {VideoFrame[]} - 已解码视频帧队列 */
    frames = [];
    /** @type {VideoFrame[]} - 已解码蒙版视频帧队列 */
    maskFrames = [];
    /** @type {HTMLCanvasElement} - 画布元素 */
    canvas = null;
    /** @type {CanvasRenderingContext2D}  - 画布2D渲染上下文*/
    canvasCtx = null;
    /** @type {OffscreenCanvas} - 离屏画布对象 */
    offscreenCanvas;
    /** @type {OffscreenCanvasRenderingContext2D} - 离屏2D画布渲染上下文 */
    offscreenCanvasCtx;
    /** @type {number} - 偏移时间量 */
    offsetTime = 0;
    /** @type {boolean} - 是否被移除 */
    removed = false;
    /** @type {boolean} - 是否已销毁 */
    destoryed = false;
    /** @type {VideoDecoder} - 视频解码器 */
    decoder = null;
    /** @type {VideoDecoder} - 蒙版视频解码器 */
    maskDecoder = null;
    /** @type {number} - 等待视频帧下标 */
    waitFrameIndex = null;
    /** @type {number} - 等待蒙版视频帧下标 */
    waitMaskFrameIndex = null;
    /** @type {Function} - 等待视频帧回调 */
    waitFrameCallback = null;
    /** @type {Function} - 等待蒙版视频帧回调 */
    waitMaskFrameCallback = null;

    /**
     * 构造函数
     * 
     * @param {Object} options - 视频配置选项
     * @param {string} options.url - 视频URL
     * @param {number} options.startTime - 开始播放时间点（毫秒）
     * @param {number} options.endTime - 结束播放时间点（毫秒）
     * @param {number} options.audioId = 内部音频ID
     * @param {string} [options.maskUrl] - 蒙版视频URL
     * @param {string} [options.format] - 视频格式（mp4/webm）
     * @param {number} [options.seekStart=0] - 裁剪开始时间点（毫秒）
     * @param {number} [options.seekEnd] - 裁剪结束时间点（毫秒）
     * @param {number} [options.fadeInDuration] - 视频音频淡入时长（毫秒）
     * @param {number} [options.fadeOutDuration] - 视频音频淡出时长（毫秒）
     * @param {boolean} [options.autoplay] - 是否自动播放
     * @param {number} [options.volume=100] - 视频音频音量（0-100）
     * @param {boolean} [options.loop=false] - 是否循环播放
     * @param {boolean} [options.muted=false] - 是否静音
     * @param {boolean} [options.retryFetchs=2] - 重试下载次数
     * @param {boolean} [options.ignoreCache=false] - 是否忽略本地缓存
     */
    constructor(options) {
        const u = ____util;
        u.assert(u.isObject(options), "VideoCanvas options must be Object");
        const { url, maskUrl, startTime, endTime, audioId, format, seekStart, seekEnd, fadeInDuration, fadeOutDuration, autoplay, volume, loop, muted, retryFetchs, ignoreCache } = options;
        u.assert(u.isString(url), "url must be string");
        u.assert(u.isNumber(startTime), "startTime must be number");
        u.assert(u.isNumber(endTime), "endTime must be number");
        u.assert(u.isNumber(audioId), "audioId must be number");
        u.assert(u.isUndefined(maskUrl) || u.isString(maskUrl), "maskUrl must be string");
        u.assert(u.isUndefined(format) || u.isString(format), "format must be string");
        u.assert(u.isUndefined(seekStart) || u.isNumber(seekStart), "seekStart must be number");
        u.assert(u.isUndefined(seekEnd) || u.isNumber(seekEnd), "seekEnd must be number");
        u.assert(u.isUndefined(fadeInDuration) || u.isNumber(fadeInDuration), "fadeInDuration must be number");
        u.assert(u.isUndefined(fadeOutDuration) || u.isNumber(fadeOutDuration), "fadeOutDuration must be number");
        u.assert(u.isUndefined(autoplay) || u.isBoolean(autoplay), "autoplay must be boolean");
        u.assert(u.isUndefined(volume) || u.isNumber(volume), "volume must be number");
        u.assert(u.isUndefined(loop) || u.isBoolean(loop), "loop must be boolean");
        u.assert(u.isUndefined(muted) || u.isBoolean(muted), "muted must be boolean");
        u.assert(u.isUndefined(retryFetchs) || u.isNumber(retryFetchs), "retryFetchs must be number");
        u.assert(u.isUndefined(ignoreCache) || u.isBoolean(ignoreCache), "ignoreCache must be boolean");
        this.url = url;
        this.maskUrl = maskUrl;
        this.startTime = startTime;
        this.endTime = endTime;
        this.audioId = audioId;
        this.format = format;
        this.seekStart = u.defaultTo(seekStart, 0);
        this.seekEnd = seekEnd;
        this.fadeInDuration = fadeInDuration;
        this.fadeOutDuration = fadeOutDuration;
        this.autoplay = autoplay;
        this.volume = u.defaultTo(volume, 100);
        this.loop = u.defaultTo(loop, false);
        this.muted = u.defaultTo(muted, false);
        this.retryFetchs = u.defaultTo(retryFetchs, 2);
        this.ignoreCache = u.defaultTo(ignoreCache, false);
    }

    /**
     * 绑定画布元素
     * 
     * @param {HTMLCanvasElement} canvas - 画布元素
     * @param {Object} [options] - 画布选项
     * @param {boolean} [options.alpha=true] - 是否支持透明通道
     * @param {boolean} [options.imageSmoothingEnabled=true] - 是否开启抗锯齿
     * @param {boolean} [options.imageSmoothingEnabled="high"] - 抗锯齿强度
     */
    bind(canvas, options = {}) {
        const { alpha = true, imageSmoothingEnabled = true, imageSmoothingQuality = "high" } = options;
        this.canvas = canvas;
        this.canvas.____onRemoved = () => {
            ____updateAudioEndTime(this.audioId, captureCtx.currentTime);
            this.removed = true;
        };
        // 获取画布2D上下文
        this.canvasCtx = this.canvas.getContext("2d", {
            // 是否透明通道
            alpha,
            // 设置抗锯齿开关
            imageSmoothingEnabled,
            // 设置抗锯齿强度
            imageSmoothingQuality
        });
    }

    canPlay(time) {
        if (this.destoryed) return;
        const { startTime, endTime } = this;
        // 如果当前时间超过元素开始结束时间则判定未不可播放
        if (time < startTime || time >= endTime)
            return false;
        return true;
    }

    /**
     * 加载视频
     */
    async load() {
        try {
            const datas = await this._fetchData();
            if (!datas) {
                this.destory();
                return false;
            }
            const { buffer, maskBuffer } = datas;
            const { decoder, config } = await this._createDecoder(buffer, {
                onFrame: this._emitNewFrame.bind(this),
                onError: err => console.error(err)
            });
            // 预分配视频帧数组
            this.frames = new Array(config.frameCount);
            this.decoder = decoder;
            this.config = config;
            if (maskBuffer) {
                // 预分配蒙版视频帧数组
                this.maskFrames = new Array(config.frameCount);
                // 初始化用于蒙版抠图的离屏画布
                this._initOffscreenCanvas();
                const {
                    decoder: maskDecoder,
                    config: maskConfig
                } = await this._createDecoder(maskBuffer, {
                    isMask: true,
                    onFrame: this._emitNewMaskFrame.bind(this),
                    onError: err => console.error(err)
                });
                this.maskDecoder = maskDecoder;
                const u = ____util;
                u.assert(maskConfig.codedWidth == config.codedWidth, `Mask video codedWidth (${maskConfig.codedWidth}) is inconsistent with the original video codedWidth (${config.codedWidth})`);
                u.assert(maskConfig.codedHeight == config.codedHeight, `Mask video codedHeight (${maskConfig.codedHeight}) is inconsistent with the original video codedHeight (${config.codedHeight})`);
                u.assert(maskConfig.frameCount == config.frameCount, `Mask video frameCount (${maskConfig.frameCount}) is inconsistent with the original video frameCount (${config.frameCount})`);
                u.assert(maskConfig.fps == config.fps, `Mask video fps (${maskConfig.fps}) is inconsistent with the original video fps (${config.fps})`);
            }
            if(this.config.duration <= 0) {
                this.destory();
                return false;
            }
            this.seek(0);
            return true;
        }
        catch (err) {
            console.log(err);
            this.destory();
            return false;
        }
    }

    isReady() {
        return this.decoder && this.decoder.state == "configured";
    }

    async seek(time) {
        // 已销毁不可索引
        if (this.destoryed) return;
        // 计算当前帧的下标
        const frameIndex = Math.floor(time / this.config.frameInterval);
        // 如果当前时间点帧下标和上次一样不做处理
        if (this.frameIndex === frameIndex)
            return;
        // 如果元素被移除播放已结束或画布则跳过
        if (this.removed || (!this.loop && this.isEnd()))
            return;
        // console.log(`${frameIndex}/${this.decoder.decodeQueueSize}/${this.config.frameCount}`);
        const frame = await this._acquireFrame(frameIndex);
        // console.log(frameIndex);
        let maskFrame = null;
        if (this.maskBuffer)
            maskFrame = await this._acquireMaskFrame(frameIndex);
        const { displayWidth, displayHeight } = frame;
        if (maskFrame) {
            this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.offscreenCanvasCtx.drawImage(maskFrame, 0, 0, displayWidth, displayHeight, 0, 0, this.canvas.width, this.canvas.height);
            const maskData = this.offscreenCanvasCtx.getImageData(0, 0, this.canvas.width, this.canvas.height)
            for (let i = 0; i < maskData.data.length; i += 4)
                maskData.data[i + 3] = maskData.data[i];
            this.offscreenCanvasCtx.putImageData(maskData, 0, 0);
            this.canvasCtx.drawImage(this.offscreenCanvas, 0, 0);
            this.canvasCtx.globalCompositeOperation = 'source-in';
            this.canvasCtx.drawImage(frame, 0, 0, displayWidth, displayHeight, 0, 0, this.canvas.width, this.canvas.height);
            this.canvasCtx.globalCompositeOperation = 'source-over';
        }
        else
            this.canvasCtx.drawImage(frame, 0, 0, displayWidth, displayHeight, 0, 0, this.canvas.width, this.canvas.height);
        
        frame.close();
        this.frames[frameIndex] = null;
        if (maskFrame) {
            maskFrame.close();
            this.maskFrames[frameIndex] = null;
        }
        // 更新帧下标
        this.frameIndex = frameIndex;
        // 更新当前时间点
        this.currentTime = time;
        // 如开启循环且当前已播放结束时重置
        if (this.loop && (this.isEnd() || this.currentTime >= this.config.duration)) {
            this.offsetTime += this.currentTime;
            this.reset();
        }
    }

    isEnd() {
        return this.frameIndex >= this.config.frameCount - 1;
    }

    canDestory(time) {
        // 已销毁则避免重复销毁
        if (this.destoryed) return false;
        // 返回当前时间是否大于结束实际
        return time >= this.endTime;
    }

    reset() {
        // 清除未关闭的视频帧避免内存泄露
        this._clearUnclosedFrames();
        this.frameIndex = null;
        this.currentTime = 0;
        this.decodedFrameIndex = 0;
        this.decodedMaskFrameIndex = 0;
        // 重置解码器
        this.decoder && this.decoder.reset();
        // 重置蒙版解码器
        this.maskDecoder && this.maskDecoder.reset();
    }

    /**
     * 销毁资源
     */
    destory() {
        this.decoder && this.decoder.close();
        this.decoder = null;
        this.maskDecoder && this.maskDecoder.close();
        this.maskDecoder = null;
        this._clearUnclosedFrames();
        this.buffer = null;
        this.maskBuffer = null;
        this.frameIndex = null;
        this.currentTime = 0;
        this.canvas = null;
        this.canvasCtx = null;
        this.offscreenCanvas = null;
        this.offscreenCanvasCtx = null;
        this.destoryed = true;
    }

    /**
     * 拉取视频数据
     */
    async _fetchData() {
        if (!this.buffer) {
            // console.time();
            const response = await captureCtx.fetch("/api/video_preprocess", {
                method: "POST",
                body: JSON.stringify(this._exportConfig()),
                retryFetchs: 0
            });
            // console.timeEnd();
            if (!response)
                return null;
            const {
                buffer,
                maskBuffer,
                hasMask
            } = this._unpackData(await response.arrayBuffer());
            this.buffer = buffer;
            if (hasMask)
                this.maskBuffer = maskBuffer;
        }
        return {
            buffer: this.buffer,
            maskBuffer: this.maskBuffer
        }
    }

    /**
     * 清除未关闭的帧
     */
    _clearUnclosedFrames() {
        this.frames
            .forEach(frame => frame && frame.close());
        this.frames = [];
        this.maskFrames
            .forEach(maskFrame => maskFrame && maskFrame.close());
        this.maskFrames = [];
    }

    /**
     * 初始化离屏画布
     * 
     * @param {Object} [options] - 画布选项
     * @param {boolean} [options.alpha=true] - 是否支持透明通道
     * @param {boolean} [options.imageSmoothingEnabled=true] - 是否开启抗锯齿
     * @param {boolean} [options.imageSmoothingEnabled="high"] - 抗锯齿强度
     */
    _initOffscreenCanvas(options = {}) {
        const { alpha = true, imageSmoothingEnabled = true, imageSmoothingQuality = "high" } = options;
        // 创建实验性的离屏画布
        this.offscreenCanvas = new OffscreenCanvas(this.canvas.width, this.canvas.height);
        // 获取2D渲染上下文
        this.offscreenCanvasCtx = this.offscreenCanvas.getContext("2d", { alpha, willReadFrequently: false });
        this.canvasCtx.imageSmoothingEnabled = imageSmoothingEnabled;
        this.canvasCtx.imageSmoothingQuality = imageSmoothingQuality;
    }

    /**
     * 获取视频帧
     * 
     * @param {number} frameIndex 帧下标
     * @returns {VideoFrame} - 视频帧
     */
    async _acquireFrame(frameIndex) {
        if (this.frames[frameIndex])
            return this.frames[frameIndex];
        let timer;
        await Promise.race([
            new Promise(resolve => {
                this._clearUnclosedFrames();
                this.waitFrameIndex = frameIndex;
                this.waitFrameCallback = resolve;
            }),
            new Promise((_, reject) => ____setTimeout(() => reject(new Error("Acquire video frame timeout (30s)")), 30000))
        ]);
        ____clearTimeout(timer);
        return this.frames[frameIndex];
    }

    /**
     * 获取蒙版视频帧
     * 
     * @param {number} frameIndex 帧下标
     * @returns {VideoFrame} - 蒙版视频帧
     */
    async _acquireMaskFrame(frameIndex) {
        if (this.maskFrames[frameIndex])
            return this.maskFrames[frameIndex];
        let timer;
        await Promise.race([
            new Promise(resolve => {
                this._clearUnclosedFrames();
                this.waitMaskFrameIndex = frameIndex;
                this.waitMaskFrameCallback = resolve;
            }),
            new Promise((_, reject) => ____setTimeout(() => reject(new Error("Acquire mask video frame timeout (30s)")), 30000))
        ]);
        ____clearTimeout(timer);
        return this.maskFrames[frameIndex];
    }

    /**
     * 通知新视频帧产生
     * 
     * @param {VideoFrame} frame - 视频帧
     */
    _emitNewFrame(frame) {
        frame.index = this.decodedFrameIndex;
        this.frames[frame.index] = frame;
        if (this.waitFrameCallback && this.waitFrameIndex == frame.index) {
            const fn = this.waitFrameCallback;
            this.waitFrameIndex = null;
            this.waitFrameCallback = null;
            fn();
        }
        this.decodedFrameIndex++;
    }

    /**
     * 通知新蒙版视频帧产生
     * 
     * @param {VideoFrame} frame - 视频帧
     */
    _emitNewMaskFrame(frame) {
        frame.index = this.decodedMaskFrameIndex;
        this.maskFrames[frame.index] = frame;
        if (this.waitMaskFrameCallback && this.waitMaskFrameIndex == frame.index) {
            const fn = this.waitMaskFrameCallback;
            this.waitMaskFrameIndex = null;
            this.waitMaskFrameCallback = null;
            fn();
        }
        this.decodedMaskFrameIndex++;
    }

    /**
     * 创建解码器
     * 
     * @param {Uint8Array} data - 视频数据
     * @param {Object} options - 解码器选项
     * @param {boolean} options.isMask - 是否为蒙版
     * @param {Function} options.onFrame - 视频帧回调
     * @param {Function} options.onError - 错误回调
     * @returns {Object} - 解码器和配置对象
     */
    async _createDecoder(data, options = {}) {
        const u = ____util;
        const { isMask = false, onFrame, onError } = options;
        u.assert(u.isUint8Array(data), "data must be Uint8Array");
        u.assert(u.isBoolean(isMask), "isMask must be boolean");
        u.assert(u.isFunction(onFrame), "onFrame must be Function");
        u.assert(u.isFunction(onError), "onError must be Function");
        const decoder = (isMask ? this.maskDecoder : this.decoder) || new VideoDecoder({
            output: onFrame.bind(this),
            error: onError.bind(this)
        });
        const demuxer = new ____MP4Demuxer();
        let timer;
        const waitConfigPromise = Promise.race([
            new Promise((resolve, reject) => {
                demuxer.onConfig(config => {
                    decoder.configure({
                        // 视频信息配置
                        ...config,
                        // 指示优先使用硬件加速解码
                        hardwareAcceleration: "prefer-hardware",
                        // 关闭延迟优化，让解码器批量处理解码，降低负载
                        optimizeForLatency: true
                    });
                    resolve(config);
                });
                demuxer.onError(reject);
            }),
            new Promise((_, reject) => timer = ____setTimeout(() => reject(new Error(`Video buffer demux timeout (60s)`)), 60000))
        ]);
        ____clearTimeout(timer);
        demuxer.onChunk(chunk => decoder.decode(chunk));
        demuxer.load(data);
        // 等待解码配置
        const config = await waitConfigPromise;
        // 画布宽度为0时使用解码宽度初始化
        if(this.canvas.width === 0)
            this.canvas.width = config.codedWidth;
        // 画布高度为0时使用解码高度初始化
        if(this.canvas.height === 0)
            this.canvas.height = config.codedHeight;
        // 检查视频解码器是否支持当前配置
        await VideoDecoder.isConfigSupported(config);
        if(decoder.state == "configured") {
            decoder.flush()
                .catch(err => err.message.indexOf("Aborted due to close") === -1 && err.message.indexOf("closed codec") === -1 ? console.error(err) : 0);
        }
        return {
            config,
            decoder
        };
    }

    /**
     * 导出视频配置
     * 
     * @returns {VideoConfig} - 视频配置
     */
    _exportConfig() {
        return {
            url: this.url,
            maskUrl: this.maskUrl,
            format: this.format,
            startTime: this.startTime,
            endTime: this.endTime,
            audioId: this.audioId,
            seekStart: this.seekStart,
            seekEnd: this.seekEnd,
            fadeInDuration: this.fadeInDuration,
            fadeOutDuration: this.fadeOutDuration,
            autoplay: this.autoplay,
            volume: this.volume,
            loop: this.loop,
            muted: this.muted,
            retryFetchs: this.retryFetchs,
            ignoreCache: this.ignoreCache
        };
    }

    /**
     * 解包数据
     * 从封装的ArrayBuffer中提取原始数据对象
     * 
     * @param {ArrayBuffer} packedData - 已封装数据
     * @returns {Object} - 原始数据对象
     */
    _unpackData(packedData) {
        const dataView = new DataView(packedData);
        let delimiterIndex = -1;
        for (let i = 0; i < dataView.byteLength; i++) {
            if (dataView.getUint8(i) === '!'.charCodeAt(0)) {
                delimiterIndex = i;
                break;
            }
        }
        if (delimiterIndex === -1)
            throw new Error("Invalid data format: header delimiter not found");
        const lengthBytes = new Uint8Array(dataView.buffer, 0, delimiterIndex);
        const objLength = parseInt(String.fromCharCode(...lengthBytes));
        if (isNaN(objLength) || objLength <= 0 || objLength > dataView.byteLength - delimiterIndex - 1)
            throw new Error("Invalid data format: Invalid data length");
        const objBytes = new Uint8Array(dataView.buffer, delimiterIndex + 1, objLength);
        const obj = JSON.parse(new TextDecoder("utf-8").decode(objBytes));
        const bufferOffset = delimiterIndex + 1 + objLength;
        for (const key in obj) {
            if (Array.isArray(obj[key]) && obj[key][0] === "buffer") {
                const [_, start, end] = obj[key];
                obj[key] = new Uint8Array(dataView.buffer.slice(bufferOffset + start, bufferOffset + end));
            }
        }
        return obj;
    }

}