import cliProgress from "cli-progress";

import WebVideoCreator from "../api/WebVideoCreator.js";
import logger from "../lib/logger.js";

export default async ({
    url,
    width,
    height,
    fps,
    duration,
    videoEncoder,
    outputPath
}) => {
    let totalFrameCount = null;
    const progressBar = new cliProgress.SingleBar({ hideCursor: true }, cliProgress.Presets.shades_classic);
    const wvc = new WebVideoCreator();
    wvc.config({
        mp4Encoder: videoEncoder
    });
    const video = wvc.createSingleVideo({
        url,
        width,
        height,
        fps,
        duration,
        outputPath
    });
    video.on("progress", (progress, synthesizedFrameCount, _totalFrameCount) => {
        if (!totalFrameCount) {
            totalFrameCount = _totalFrameCount;
            progressBar.start(totalFrameCount, 0);
        }
        progressBar.update(synthesizedFrameCount);
    });
    video.once("completed", () => {
        progressBar.stop();
        logger.success("Render Completed!!!");
    });
    video.start();
}