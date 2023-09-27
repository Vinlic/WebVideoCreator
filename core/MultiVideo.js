import ChunkSynthesizer from "./ChunkSynthesizer.js";
import VideoChunk from "./VideoChunk.js";

/**
 * 多幕视频
 */
export default class MultiVideo extends ChunkSynthesizer {

    

    /**
     * 构造函数
     * 
     * @param {Object} options - 单幕视频选项
     * @param {string} options.outputPath - 输出路径
     * @param {string} options.url - 页面URL
     * @param {number} options.width - 视频宽度
     * @param {number} options.height - 视频高度
     * @param {number} options.duration - 视频时长
     * @param {number} [options.fps=30] - 视频帧率
     * @param {boolean} [options.autostartRender=true] - 是否自动启动渲染，如果为false请务必在页面中执行 captureCtx.start()
     * @param {boolean} [options.consoleLog=false] - 是否开启控制台日志输出
     */
    constructor() {

    }

    

}