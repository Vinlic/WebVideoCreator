import ffmpeg from "fluent-ffmpeg";
import fs from "fs-extra";

export default class Synthesizer {

    id;
    coverPath;
    videoPath;
    frameIndex = 0;
    videoEncoder;
    audioEncoder;
    #videoEncodeProgress;
    #audioEncoderProgress;
    #lastFrame = null;

    constructor(id) {
        this.id = id;
        fs.removeSync(`./test${this.id}`);
        fs.ensureDirSync(`./test${this.id}`);
    }

    inputFrame(data, timestamp) {
        fs.writeFile(`./test${this.id}/v_${this.frameIndex++}.jpg`, data).catch(err => console.error(err));
        // console.log(data);
        // this.#lastFrame = data;
    }

}