import { VIDEO_ENCODER, AUDIO_ENCODER } from "./const.js";

export default {

    debug: false,
    
    browserDebug: false,
    
    ffmpegDebug: false,

    browserUseGPU: true,
    
    videoEncoder: VIDEO_ENCODER.CPU.H264,

    audioEncoder: AUDIO_ENCODER.AAC

};