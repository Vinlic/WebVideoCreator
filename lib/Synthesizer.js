import ffmpeg from "fluent-ffmpeg";
import fs from "fs-extra";

// 合成器计数
let synthesizerIndex = 1;

export default class Synthesizer {

    static VCODEC = {
        CPU: {
            H264: "libx264",
            H265: "libx265"
        },
        INTEL: {
            H264: "h264_qsv",
            H265: "hevc_qsv"
        },
        AMD: {
            H264: "h264_amf",
            H265: "h265_amf"
        },
        NVIDIA: {
            H264: "h264_nvenc",
            H265: "hevc_nvenc"
        },
        OMX: {
            H265: "h264_omx"
        },
        V4L2: {
            H264: "h264_v4l2m2m"
        },
        // h264_vaapi 
        // h264_videotoolbox
    };

    id = `Synthesizer@${synthesizerIndex++}`;
    coverPath;
    videoPath;

    /**
     * 
     * @param {Object} options - 合成器选项
     * @param {string} coverPath - 封面路径
     * @param {string} videoPath - 视频路径
     * @param {number} videoWidth - 视频宽度
     * @param {number} videoHeight - 视频高度
     * @param {string} videoCodec - 视频编码器（libx264/libx265/h264_nvenc/hevc_nvenc）
     * @param {number} videoQuality - 视频质量（0-100）
     */
    constructor(options) {
        assert(_.isObject(options), "Synthesizer options must be object");
    }

    createCommand() {
        return ffmpeg();
    }

}