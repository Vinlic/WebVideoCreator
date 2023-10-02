[简体中文](./README.md) | [English](./README.en-US.md)

<p align="center" style="background:#fff">
  <img width="650px" src="./assets/web-video-creator.png" />
</p>

# Introduction

WebVideoCreator (abbreviated as WVC) is a framework for creating videos based on Node.js + Puppeteer + FFmpeg. It performs deterministic rendering, accurately capturing any animations that can be played in HTML5, including CSS3 animations, SVG animations, Lottie animations, GIF animations, APNG animations, and WEBP animations. It also supports any timeline-based animations driven by [RAF](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/requestAnimationFrame), with [anime.js](https://animejs.com/) being a great choice :D. Of course, you can also mischievously use setInterval or setTimeout to control animations.WVC supports embedding mp4 and transparent webm videos, as well as providing features for transition composition, audio synthesis, and font loading. Let's get started with the [quick start](#quick-start).

WVC creates a virtual time environment for your cool animated web pages (you can maybe imagine it as something like "The Truman Show"). Its primary responsibility is to transform an environment of "uncertain rendering" into one of "deterministic rendering."

## Uncertain Rendering Environment

In everyday usage, browsers don't render animations in real-time synchronization. When the system load is high, there may be dropped frames, resulting in animations that appear less smooth. To improve performance, browsers often delegate some decoding/rendering tasks to other threads, causing asynchrony in the timeline of animations (the video element is a classic example of this). Such conditions are unreliable for video rendering, where each frame's animation effect should be deterministic.

## Deterministic Rendering Environment

For the rendering code, it remains unaware of the changes, and everything continues as usual. However, the passage of time is no longer unstable. The currentTime returned by RAF, the timing of callbacks for setTimeout and setInterval, Date, performance.now, and so on, are all determined based on the current progress of rendering. Apart from taking control of the clock, experimental approaches like [WebCodecs API](https://github.com/w3c/webcodecs) have been adopted for handling dynamic images and embedded videos.

All of this is made possible with the support of the experimental Headless API provided by Chrome: [HeadlessExperimental.beginFrame](https://chromedevtools.github.io/devtools-protocol/tot/HeadlessExperimental/#method-beginFrame).

# Features

- Developed based on Node.js, making it extremely user-friendly, easy to extend, and develop with.
- Exceptionally fast video processing, capable of rendering a 5-minute video in as little as 1 minute.
- Supports single-scene and multi-scene video rendering and composition, with the ability to apply transition effects to multi-scene videos.
- Enables chunked video composition, allowing chunks to be distributed to multiple devices for rendering, and then reassembling them into multi-scene videos, significantly reducing rendering time for long videos.
- Supports parallel execution of multiple video rendering and composition tasks, making optimal use of system resources.
- Offers GPU acceleration for rendering and composition, resulting in significant reductions in video rendering time.
- Can be deployed and run on both Windows and Linux platforms.

# Availability

In theory, all web animation/graphics libraries should work smoothly in the WVC environment. Below is a list of libraries that I have verified to be compatible:

[Anime.js](https://animejs.com/) / [GSAP](https://greensock.com/) / [D3.js](https://d3js.org/) / [Three.js](https://threejs.org/) / [Echart](https://echarts.apache.org/) / [Lottie-Web](http://airbnb.io/lottie/#/web) / [PixiJS](https://pixijs.download/release/docs/index.html) / [Animate.css](https://animate.style/) / [Mo.js](https://mojs.github.io/) / [Tween.js](https://tweenjs.github.io/tween.js/)

It's worth noting that if you manually use [RAF](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) to drive animations, make sure to receive the timestamp parameter from the callback to set the animation's progress to that time point. Otherwise, frame rate asynchrony may occur.

# Interesting demo

...

# Quick start

## Installation

```shell
npm i web-video-creator
```
If you encounter issues with the download of ffmpeg-static, please set the environment variable first: `FFMPEG_BINARIES_URL=https://cdn.npmmirror.com/binaries/ffmpeg-static`

## Simply use

```javascript
import WebVideoCreator, { VIDEO_ENCODER } from "web-video-creator";

const wvc = new WebVideoCreator();

// Configure WVC
wvc.config({
    // Choose an appropriate encoder based on your hardware. Here, we are using the h264_nvenc encoder for Nvidia graphics cards.
    // You can refer to the options provided in VIDEO_ENCODER for encoder selection.
    mp4Encoder: VIDEO_ENCODER.NVIDIA.H264
});

// Create a single-scene video
const video = wvc.createSingleVideo({
    // URL of the page to be rendered
    url: "http://localhost:8080/test.html",
    // Video width
    width: 1280,
    // Video height
    height: 720,
    // Video frame rate
    fps: 30,
    // Video duration
    duration: 10000,
    // Output path for the video
    outputPath: "./test.mp4",
    // Display progress bar in the command line
    showProgress: true
});

// Listen for the completion event
video.once("completed", result => {
    console.log("Render Completed!!!", result);
});

// Start rendering
video.start();
```

## Single video example

<img style="width:550px" src="./assets/single-video.gif" />

The calling example code comes from: [examples/single-video.js](./examples/single-video.js)

```javascript
import { examples, VIDEO_ENCODER } from "web-video-creator";

await examples.singleVideo({
    // URL of the page to be rendered
    url: "http://localhost:8080/test.html",
    // Video width
    width: 1280,
    // Video height
    height: 720,
    // Video frame rate
    fps: 30,
    // Video duration
    duration: 10000,
    // Choose an appropriate encoder based on your hardware. Here, we are using the h264_nvenc encoder for Nvidia graphics cards.
    // You can refer to the options provided in VIDEO_ENCODER for encoder selection.
    videoEncoder: VIDEO_ENCODER.NVIDIA.H264,
    // Output path for the video
    outputPath: "./test.mp4"
});
```

## Mutli video example

<img style="width:550px" src="./assets/multi-video.gif" />

The calling example code comes from: [examples/multi-video.js](./examples/multi-video.js)

```javascript
import { examples, VIDEO_ENCODER, TRANSITION } from "web-video-creator";

await examples.multiVideo({
    // List of video chunks
    chunks: [
        {
            url: "http://localhost:8080/scene1.html",
            duration: 10000,
            // Use circular crop transition when switching to the next scene
            transition: TRANSITION.CIRCLE_CROP
        },
        {
            url: "http://localhost:8080/scene2.html",
            duration: 10000
        },
        // Add more scenes as needed
        // ...
    ],
    // Video width
    width: 1280,
    // Video height
    height: 720,
    // Video frame rate
    fps: 30,
    // Choose an appropriate encoder based on your hardware. Here, we are using the h264_nvenc encoder for Nvidia graphics cards.
    // You can refer to the options provided in VIDEO_ENCODER for encoder selection.
    videoEncoder: VIDEO_ENCODER.NVIDIA.H264,
    // Output path for the video
    outputPath: "./test.mp4"
});
```

# Features example

# API reference


# Performance Tips

Performance is typically influenced by the complexity of animations and media. You can divide long animations into multiple segments for playback. For example, you can add a "seek" parameter to each page URL, load the page, seek to a specific time point, and start playback. Then, you can render and composite them as a multi-scene video, significantly reducing rendering time for long videos.

- Render more video chunks in parallel. If you want to maximize system resources, set the parallel number to match the number of CPU threads.
- CPU clock speed has a significant impact on baseline speed. Consumer-grade CPUs often have high clock speeds, which can provide better performance.
- It is recommended to use GPU acceleration for rendering and composition. If your device has a GPU but it's not being utilized, check the configuration settings or report the issue.
- Using an SSD (Solid State Drive) can improve hard disk cache write performance during parallel rendering, reducing rendering time.
- Choosing the right video hardware encoder is essential. The default is software encoding (libx264 for mp4 and libvpx for webm). If you have integrated or dedicated graphics device, remember to configure them to use the supported hardware encoders.
- Some delays may result from network file transfers. It's advisable to deploy the static file server on the same server or access the file server from a local network.

---

Currently, I do not have better test equipment, so I will use the performance parameters of my personal host as a reference:

CPU: AMD Ryzen 7 3700X (Base Clock 3.6GHz, Boost Clock 4.4GHz, 8 Cores, 16 Threads)

GPU: Nvidia GeForce GTX 1660 SUPER (6GB VRAM, Supports NVENC)

RAM: 16GB (DDR4 2400MHz)

Video Types: SVG animations + GIF + Lottie animations

Video Resolution: 1280x720

Video Frame Rate: 30

Video Duration: 300 seconds (5 minutes)

Rendering Time: 61 seconds (1 minute)

Real-time Rate: 4.844

Parallel Rendering Count: 16

# Limitations

- Constrained by browser [secure context restrictions](https://w3c.github.io/webappsec-secure-contexts/), WebVideoCreator can only access domains that are localhost / 127.0.0.1 or those using HTTPS with valid certificates. From a security perspective, it is recommended to use a local static server (live-server is a good choice).
- Deployment on macOS is currently not supported due to crashes caused by the headless experimental API on that platform.
- WebVideoCreator is a pure ESM (ECMAScript Module) package and cannot be imported using the CommonJS style. If you still wish to use `require` for imports, please refer to: https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c