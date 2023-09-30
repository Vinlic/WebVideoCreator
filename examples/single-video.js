/**
 * 单幕视频合成示例
 * 
 * 调用代码：
 * import { examples, VIDEO_ENCODER } from "web-video-creator";
 * await examples.singleVideo({
 *     url: "http://localhost:8080/test.html",
 *     width: 1280,
 *     height: 720,
 *     fps: 30,
 *     duration: 10000,
 *     videoEncoder: VIDEO_ENCODER.NVIDIA.H264,  // 根据您的硬件设备选择适合的编码器
 *     outputPath: "./test.mp4"
 * });
 */

import WebVideoCreator, { logger } from "../index.js";

export default async ({
    url,
    width,
    height,
    fps,
    duration,
    videoEncoder,
    outputPath
}) => {
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
        outputPath,
        showProgress: true
    });
    video.once("completed", result => logger.success(`Render Completed!!!\nvideo duration: ${Math.floor(result.duration / 1000)}s\ntakes: ${Math.floor(result.takes / 1000)}s\nRTF: ${result.rtf}`));
    video.start();
}