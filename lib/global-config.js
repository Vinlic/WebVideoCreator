import { VIDEO_ENCODER, AUDIO_ENCODER } from "./const.js";

export default {

    debug: false,
    
    browserDebug: false,
    
    ffmpegDebug: false,

    ffmpegExecutablePath: null,

    ffprobeExecutablePath: null,

    browserUseGPU: true,
    
    browserExecutablePath: null,

    /**
     * 兼容渲染模式
     * 
     * 不建议启用，启用后将禁用HeadlessExperimental.beginFrame API调用改为普通的screenshot
     * 会导致渲染性能下降，且部分动画可能帧率无法同步
     */
    compatibleRenderingMode: false,

    numBrowserMin: 1,

    numBrowserMax: 5,

    numPageMin: 1,

    numPageMax: 5,
    
    mp4Encoder: VIDEO_ENCODER.CPU.H264,

    webmEncoder: VIDEO_ENCODER.CPU.VP8,

    audioEncoder: AUDIO_ENCODER.AAC

};