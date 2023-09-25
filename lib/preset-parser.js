import assert from "assert";
import _ from "lodash";

import { VIDEO_ENCODER, AUDIO_ENCODER } from "./const.js";

export default preset => {
    assert(_.isString(preset), "preset must be string");
    const [RDR, A1, VENC, A2, A3, AENC, A4, SIZE, width, height, FPS, fps, DUR, duration] = preset.split("_");
    assert(RDR == "RDR" && VENC == "VENC" && AENC == "AENC" && SIZE == "SIZE" && FPS == "FPS" && DUR == "DUR", "preset format invalid");
    assert(_.isString(VIDEO_ENCODER[A2][A3]), `video codec ${A2}_${A3} is not supported`);
    assert(_.isString(AUDIO_ENCODER[A4]), `audio codec ${A4} is not supported`);
    assert(_.isFinite(Number(width)), "fps is invalid");
    assert(_.isFinite(Number(height)), "height is invalid");
    assert(_.isFinite(Number(fps)), "fps is invalid");
    assert(_.isFinite(Number(duration)), "duration is invalid");
    return {
        useGPU: A1 == "CPU" ? false : true,
        videoEncoder: VIDEO_ENCODER[A2][A3],
        audioEncoder: AUDIO_ENCODER[A4],
        width: width ? Number(width) : null,
        height: height ? Number(height) : null,
        fps: fps ? Number(fps) : null,
        duration: duration ? Number(duration) : null
    };
}