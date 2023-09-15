import assert from "assert";

import VideoChunk from "./VideoChunk.js";

/**
 * 视频块合成器
 */
export default class ChunkSynthesizer {

    #chunks = [];

    constructor() {
        
    }

    input(chunk) {
        assert(chunk instanceof VideoChunk, "input chunk must be VideoChunk");
        this.#chunks.push(chunk);
    }

    endInput() {

    }

}