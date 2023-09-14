import ffmpeg from "fluent-ffmpeg";

import FrameSynthesizer from "./FrameSynthesizer.js";

/**
 * 视频分块
 */
export default class VideoChunk extends FrameSynthesizer {

    /**
     * 构造函数
     * 
     * @param {Object} options - 序列帧合成器选项
     * @param {number} options.width - 视频宽度
     * @param {number} options.height - 视频高度
     * @param {number} options.fps - 视频合成帧率
     * @param {string} [options.outputPath] - 导出视频路径
     * @param {number} [options.duration] - 视频时长
     * @param {string} [options.format] - 导出视频格式
     * @param {string} [options.coverPath] - 导出封面路径
     * @param {number} [options.coverCaptureTime] - 封面捕获时间点（毫秒）
     * @param {string} [options.liveUrl] - 直播推流地址
     * @param {string} [options.videoCodec] - 视频编码器
     * @param {number} [options.videoQuality] - 视频质量（0-100）
     * @param {string} [options.videoBitrate] - 视频码率（设置码率将忽略videoQuality）
     * @param {string} [options.pixelFormat] - 像素格式（yuv420p/yuv444p/rgb24）
     * @param {number} [options.parallelWriteFrames=10] - 并行写入帧数
     */
    constructor(options) {
        super(options);

    }

    /**
     * 创建视频编码器
     * 
     * @returns {FfmpegCommand} - 编码器
     */
    createVideoEncoder() {
        const { width, height, fps, outputPath, videoCodec,
            videoBitrate, videoQuality, pixelFormat } = this
        const vencoder = ffmpeg();
        // 设置视频码率将忽略质量设置
        if (videoBitrate)
            vencoder.videoBitrate(videoBitrate);
        else {
            // 计算总像素量
            const pixels = width * height;
            // 根据像素总量设置视频码率
            vencoder.videoBitrate(`${(2560 / 921600 * pixels) * (videoQuality / 100)}k`);
        }
        if(format == "mp4") {
            // 使用主要配置
            vencoder.outputOption("-profile:v main");
            // // 使用中等预设
            vencoder.outputOption("-preset medium");
        }
        const isH265 = videoCodec.indexOf("h264") == -1;
        vencoder
            .setSize(`${width}x${height}`)
            .addInput(this.pipeStream)
            // 使用图像管道
            .inputFormat("image2pipe")
            // 指定输入帧率
            .inputFPS(fps)
            // 去除冗余信息
            .inputOption("-hide_banner")
            // 指定视频编码器
            .videoCodec(videoCodec)
            // 使用主要配置
            .outputOption("-profile:v main")
            // 使用中等预设
            .outputOption("-preset medium")
            // 设置像素格式
            .outputOption("-pix_fmt", pixelFormat)
            .outputOption(`-bsf:v ${isH265 ? "hevc_mp4toannexb" : "h264_mp4toannexb"}`)
            // 指定输出格式
            .toFormat("mpegts")
            // 指定输出路径
            .addOutput(`${outputPath}.ts`);
        this.encoder = vencoder;
        return vencoder;
    }

    /**
     * 添加音频
     * 
     * @param {Audio} audio - 音频对象
     */
    addAudio(audio) {
        throw new Error("Video chunk does not support adding audio. Please use ChunkSynthesizer to merge VideoChunk for audio synthesis");
    }

}