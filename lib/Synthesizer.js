import ffmpeg from "fluent-ffmpeg";
import fs from "fs-extra";

export default class Synthesizer {

    coverPath;
    videoPath;
    frameIndex = 0;
    videoEncoder;
    audioEncoder;
    #videoEncodeProgress;
    #audioEncoderProgress;
    #frameInterval;
    #lastFrame = null;

    constructor() {
        this.#frameInterval = 1000 / 60;
    }

    inputFrame(data) {
        fs.writeFile(`./test/v_${this.frameIndex++}.jpg`, data).catch(err => console.error(err));
        // console.log(data);
        this.#lastFrame = data;
    }

    padDuration(duration) {
        if(!this.#lastFrame) return;
        const promises = [];
        for(let current = 0;current <= duration;current += this.#frameInterval) {
            promises.push(fs.writeFile(`./test/v_${this.frameIndex++}.jpg`, this.#lastFrame));
        }
        Promise.all(promises).catch(err => console.error(err));
        return promises.length;
    }

}