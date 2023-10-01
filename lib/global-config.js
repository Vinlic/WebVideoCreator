import { VIDEO_ENCODER, AUDIO_ENCODER } from "./const.js";

export default {

    debug: false,
    
    browserDebug: false,
    
    ffmpegDebug: false,

    ffmpegExecutablePath: null,

    ffprobeExecutablePath: null,

    browserUseGPU: true,
    
    browserExecutablePath: null,

    numBrowserMin: 1,

    numBrowserMax: 5,

    numPageMin: 1,

    numPageMax: 5,
    
    mp4Encoder: VIDEO_ENCODER.CPU.H264,

    webmEncoder: VIDEO_ENCODER.CPU.VP8,

    audioEncoder: AUDIO_ENCODER.AAC

};