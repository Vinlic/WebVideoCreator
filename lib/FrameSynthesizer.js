import assert from "assert";
import { PassThrough } from "stream";
import _ from "lodash";

import Synthesizer from "./Synthesizer.js";

/**
 * 序列帧合成器
 */
export default class FrameSynthesizer extends Synthesizer {


    /** @type {number} - 并行写入帧数 */
    parallelWriteFrames;
    // 序列帧队列
    /** @type {Buffer[]} */
    #frameBuffers = null;  
    #frameBufferIndex = 0;
    // 帧写入管道流
    #pipeStream = null;

    /**
     * 构造函数
     * 
     * @param {Object} options - 序列帧合成器选项
     * @param {number} [options.parallelWriteFrames=10] - 并行写入帧数
     */
    constructor(options) {
        super(options);
        const { parallelWriteFrames } = options;
        assert(_.isUndefined(parallelWriteFrames) || _.isFinite(parallelWriteFrames), "parallelWriteFrames must be number");
        this.parallelWriteFrames = _.defaultTo(parallelWriteFrames, 10);
        this.#frameQueue = new Array(this.parallelWriteFrames);
        this.#pipeStream = new PassThrough();
    }

    async start() {
        const ffmpeg = this.createCommand();
    }

    /**
     * 输入帧
     * 
     * @param {Buffer} buffer - 帧缓冲区
     */
    input(buffer) {
        this.#frameBuffers[this.#frameBufferIndex] = buffer;
        if(this.#frameBufferIndex++ < this.parallelWriteFrames)
            return;
        this.#pipeStream.write(Buffer.concat(this.#frameBuffers));
        this.#frameBufferIndex = 0;
    }
    
    /**
     * 结束帧输入
     */
    endInput() {
        this.#drain();

    }

    /**
     * 将缓冲区剩余帧写入管道
     */
    #drain() {
        if(this.#frameBufferIndex == 0)
            return;
        this.#pipeStream.write(Buffer.concat(this.#frameBuffers));
        this.#frameBufferIndex = 0;
    }

}