import WebVideoCreator from "./api/WebVideoCreator.js";
import SingleVideo from "./api/SingleVideo.js";
import MultiVideo from "./api/MultiVideo.js";
import ChunkVideo from "./api/ChunkVideo.js";
import examples from "./examples/index.js";
import * as core from "./core/index.js";
import * as entity from "./entity/index.js";
import util from "./lib/util.js";

import { VIDEO_ENCODER, AUDIO_ENCODER, TRANSITION } from "./lib/const.js";

export default WebVideoCreator;
export {
    /** 视频编码器 */
    VIDEO_ENCODER,
    /** 音频编码器 */
    AUDIO_ENCODER,
    /** 转场效果 */
    TRANSITION,
    /** 单幕视频 */
    SingleVideo,
    /** 多幕视频 */
    MultiVideo,
    /** 分块视频 */
    ChunkVideo,
    /** 示例 */
    examples,
    /** 核心类 */
    core,
    /** 实体类 */
    entity,
    /** 工具类 */
    util
};