import ____MP4Box, { ISOFile } from "mp4box";

/**
 * MP4解复用器
 */
export default class MP4Demuxer {

    /** @type {ISOFile} - 文件对象 */
    file;
    /** @type {Function} - 配置回调函数 */
    _configCallback;
    /** @type {Function} - 视频块回调函数 */
    _chunkCallback;

    /**
     * 构造函数
     */
    constructor() {
        this.file = ____MP4Box.createFile();
        this.file.onReady = this._onReady.bind(this);
        this.file.onSamples = this._onSamples.bind(this);
    }

    /**
     * 监听配置
     * 
     * @param {Function} fn - 配置回调函数 
     */
    onConfig(fn) {
        this._configCallback = fn;
    }

    /**
     * 监听视频块
     * 
     * @param {Function} fn - 视频块回调函数
     */
    onChunk(fn) {
        this._chunkCallback = fn;
    }

    /**
     * 监听错误
     * 
     * @param {Function} fn - 错误回调函数
     */
    onError(fn) {
        this.file.onError = fn;
    }

    /**
     * 加载文件
     */
    load(buffer) {
        buffer.buffer.fileStart = 0;
        this.file.appendBuffer(buffer.buffer);
        this.file.flush();
    }

    /**
     * 文件已就绪
     * 
     * @param {Object} info - 视频信息
     */
    _onReady(info) {
        // 选取第一条视频轨道
        const track = info.videoTracks[0];
        // 兼容编码映射
        const COMPLATIBLE_CODEC_MAP = {
            "avc1.64003c": "avc1.640033"
        };
        // 配置信息回调用于配置视频解码器
        const duration = (track.movie_duration / track.movie_timescale * 1000) || (track.samples_duration / track.timescale * 1000);
        const fps = Number((track.nb_samples / duration * 1000).toFixed());
        const frameInterval = duration / track.nb_samples;
        this._configCallback && this._configCallback({
            codec: track.codec.startsWith('vp08') ? 'vp8' : (COMPLATIBLE_CODEC_MAP[track.codec] || track.codec),
            codedWidth: track.video ? track.video.width : track.track_width,
            codedHeight: track.video ? track.video.height : track.track_height,
            description: this._getDescription(track),
            bitrate: track.bitrate,
            duration,
            fps,
            frameInterval,
            frameCount: track.nb_samples
        });
        // 开始文件解复用
        this.file.setExtractionOptions(track.id);
        this.file.start();
    }

    /**
     * 获得样本
     * 
     * @param {number} track_id - 轨道ID
     * @param {Object} ref - 引用
     * @param {Object[]} samples - 样本列表
     */
    _onSamples(track_id, ref, samples) {
        // 将所有样本回调
        for (const sample of samples) {
            this._chunkCallback && this._chunkCallback(new EncodedVideoChunk({
                type: sample.is_sync ? "key" : "delta",
                timestamp: 1e6 * sample.cts / sample.timescale,
                duration: 1e6 * sample.duration / sample.timescale,
                data: sample.data
            }));
        }
    }

    /**
     * 获取描述信息
     * 
     * @param {Object} track - 轨道对象
     * @returns {Uint8Array} - 描述信息
     */
    _getDescription(track) {
        const trak = this.file.getTrackById(track.id);
        for (const entry of trak.mdia.minf.stbl.stsd.entries) {
            const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
            if (box) {
                const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
                box.write(stream);
                return new Uint8Array(stream.buffer, 8);
            }
        }
        throw new Error("avcC, hvcC, vpcC, or av1C box not found");
    }

}