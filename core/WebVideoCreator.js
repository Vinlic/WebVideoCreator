import _ from "lodash";

import globalConfig from "../lib/global-config.js";
import logger from "../lib/logger.js";
import { VIDEO_ENCODER } from "../lib/const.js";
import ResourcePool from "./ResourcePool.js";
import SingleVideo from "./SingleVideo.js";

export default class WebVideoCreator {

    /** @type {ResourcePool} - 资源池 */
    pool = null;

    constructor() {

    }

    /**
     * 配置引擎
     * 
     * @param {globalConfig} config - 配置对象
     */
    config(config = {}) {
        for (let key in globalConfig) {
            if (!_.isUndefined(config[key]))
                globalConfig[key] = config[key];
        }
        const { browserUseGPU, numBrowserMax, numBrowserMin, numPageMax, numPageMin, videoEncoder } = globalConfig;
        if (!browserUseGPU)
            logger.warn("browserUseGPU is turn off, recommended to turn it on to improve rendering performance");
        if (Object.values(VIDEO_ENCODER.CPU).includes(videoEncoder))
            logger.warn(`Recommended to use video hard coder to accelerate video synthesis, currently used is ${globalConfig.videoEncoder}`);
        this.pool = new ResourcePool({
            numBrowserMin,
            numBrowserMax,
            browserOptions: {
                numPageMin,
                numPageMax
            },
            videoPreprocessorOptions: {
                videoEncoder
            }
        });
    }

    createSingleVideo(options) {
        const singleVideo = new SingleVideo(options);
        singleVideo.onPageAcquire(async () => await this.pool.acquirePage());
        return singleVideo;
    }

    createMultiVideo() {

    }

}