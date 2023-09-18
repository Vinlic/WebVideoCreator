import assert from "assert";
import cliProgress from "cli-progress";
import _ from "lodash";

import { AUDIO_CODEC, ResourcePool, Synthesizer, VIDEO_CODEC } from "../index.js";
import util from "../lib/util.js";

export default async ({
    url,
    width,
    height,
    fps,
    duration,
    browserUseGPU,
    videoCodec,
    audioCodec,
    outputPath
}) => {
    url = _.defaultTo(url, "");
    width = _.defaultTo(width, 1280);
    height = _.defaultTo(height, 720);
    fps = _.defaultTo(fps, 30);
    duration = _.defaultTo(duration, 20000);
    browserUseGPU = _.defaultTo(browserUseGPU, true);
    videoCodec = _.defaultTo(videoCodec, VIDEO_CODEC.NVIDIA.H264);
    audioCodec = _.defaultTo(audioCodec, AUDIO_CODEC.AAC);

    assert(util.isURL(url), "url is invalid");
    assert(_.isFinite(width) && _.isFinite(height), "width and height must be number");
    assert(_.isFinite(fps), "fps must be number");
    assert(_.isBoolean(browserUseGPU), "browserUseGPU must be boolean");
    assert(_.isString(videoCodec), "videoCodec must be string");
    assert(_.isString(audioCodec), "audioCodec must be string");
    assert(_.isString(outputPath), "outputPath must be string");

    // 计算总帧数
    const frameCount = util.durationToFrameCount(duration, fps);
    // cli进度条
    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progressBar.start(frameCount, 0);

    // 实例化无头浏览器资源池
    const pool = new ResourcePool({
        // 浏览器资源最小数量
        numBrowserMin: 1,
        // 浏览器资源最大数量
        numBrowserMax: 5,
        // 浏览器选项
        browserOptions: {
            // 如果您有[独显]或者[核显]建议开启以加速渲染
            useGPU: browserUseGPU,
            // 页面资源最小数量
            numPageMin: 1,
            // 页面资源最大数量
            numPageMax: 5
        }
    });

    // 预热资源池
    await pool.warmup();
    // 获取页面资源，它将从资源池自动获取可用的页面
    const page = await pool.acquirePage();
    // 设置视窗宽高
    await page.setViewport({ width, height });
    // 跳转到您希望渲染的页面，您可以考虑创建一个本地的Web服务器提供页面以提升加载速度和安全性
    await page.goto(url);
    // 监听页面打印到console的正常日志
    page.on("consoleLog", message => console.log(message));
    // 监听页面打印到console的错误日志
    page.on("consoleError", err => console.error(err));
    // 监听页面实例发生的某些内部错误
    page.on("error", err => console.error("page error:", err));
    // 监听页面是否崩溃，当内存不足或过载时可能会崩溃
    page.on("crashed", err => console.error("page crashed:", err));

    console.time("\nrender");
    // 实例化合成器实例
    const synthesizer = new Synthesizer({
        // 输出文件路径
        outputPath,
        // 视频宽度
        width,
        // 视频高度
        height,
        // 视频帧率，请确保和page的捕获帧率一致
        fps,
        // 视频时长，如果未设置将无法获知正确合成进度
        duration,
        // 如果您有[独显]或者[核显]建议选择硬件编码器，请参考VIDEO_CODEC定义
        // 如果使用VIDEO_CODEC.INTEL.H264将启用Intel核显的QSV编码器加速编码
        // 如果使用VIDEO_CODEC.NVIDIA.H264将启用Nvidia显卡的NVENC编码器加速编码
        // 如果不具备任何图形加速设备请使用CPU软编码
        videoCodec,
        audioCodec
    });
    // 监听合成进度
    synthesizer.on("progress", (progress, frameCount) => progressBar.update(frameCount));
    // 监听合成器错误
    synthesizer.on("error", err => console.error(err));
    synthesizer.addAudio({
        path: "test.mp3",
        // loop: true
    });
    // 启动合成
    synthesizer.start();
    // 合成完成promise
    const completedPromise = new Promise(resolve => synthesizer.once("completed", resolve));
    // 监听已渲染的帧输入到合成器
    page.on("frame", buffer => synthesizer.input(buffer));
    // 启动捕获
    await page.startScreencast({
        // 捕获帧率，请确保和synthesizer的合成帧率一致
        fps,
        // 捕获时长
        duration
    });
    // 监听并等待录制完成
    await new Promise(resolve => page.once("screencastCompleted", resolve));
    
    // 停止录制
    await page.stopScreencast();
    // 释放页面资源
    await page.release();
    // 告知合成器结束输入
    synthesizer.endInput();
    // 等待合成完成
    await completedPromise;
    console.timeEnd("\nrender");
    progressBar.stop();
}