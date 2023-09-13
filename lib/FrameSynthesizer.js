import { List } from "linked-list";

import Synthesizer from "./Synthesizer";

class FrameSynthesizer extends Synthesizer {

    #frameQueue = new List();

    constructor(options = {}) {
        super(options);
        
    }

    /**
     * 推入帧
     * 
     * @param {Buffer} buffer - 帧数据
     */
    pushFrame(buffer) {
        this.#frameQueue.append(buffer);
    }



}