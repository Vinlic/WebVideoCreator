[简体中文](./README.md) | [English](./README.en-US.md)

<p align="center" style="background:#fff">
  <img width="650px" src="./assets/web-video-creator.png" />
</p>

# Introduction

WebVideoCreator (abbreviated as WVC) is a framework for creating videos based on Node.js + Puppeteer + FFmpeg. It performs deterministic rendering and captures any HTML5-playable animations (CSS3 animations/SVG animations/Lottie animations/GIF animations/APNG animations/WEBP animations) and any timeline-based animations driven by [RAF](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame). You can also mischievously use `setInterval` or `setTimeout` to control animations. WVC supports embedding MP4 and transparent WebM videos, as well as features such as transition compositing, audio synthesis, and font loading. Let's get started with the [Quick Start](#quick-start).

WVC creates a virtual time environment for your cool animated pages, which can be imagined as something akin to "The Truman Show." Its main responsibility is to transform an **uncertain rendering environment** into a **deterministic rendering environment**.

### Uncertain Rendering Environment

In everyday usage, web browsers do not render animations in "real-time synchronization." When system load is high, there may be frame drops, resulting in animations that appear less smooth. To improve performance, browsers typically offload some decoding/rendering tasks to other threads, causing asynchrony in the timeline of animations (the `video` element is a classic example). These aspects are unreliable for video rendering, where every frame of animation should be deterministic.

### Deterministic Rendering Environment

For the code executing the rendering, it remains oblivious to the change. Everything happens as usual, but the flow of time becomes controllable. `currentTime` returned by RAF, the timing of callbacks for `setTimeout`/`setInterval`, `Date`, `performance.now`, and so on, are all determined based on the current progress of rendering. In addition to taking control of the clock, for dynamic images and embedded videos, typically not under the developer's control, experimental [WebCodecs API](https://github.com/w3c/webcodecs) has been used for takeover.

All of this is made possible by Chrome's provided [deterministic rendering mode](https://goo.gle/chrome-headless-rendering) and support for the headless experimental API: [HeadlessExperimental.beginFrame](https://chromedevtools.github.io/devtools-protocol/tot/HeadlessExperimental/#method-beginFrame).

<br>

# Features

- Developed using Node.js, it's very easy to use, extend, and develop further.
- Video processing is incredibly fast, rendering a video as long as 5 minutes can be completed in just 1 minute.
- Supports rendering and compositing of single scenes and multi-scene videos, with the ability to apply transition effects to multi-scene videos.
- Supports chunked video compositing, allowing chunks to be distributed to multiple devices for rendering, then combined into multi-scene videos, significantly reducing rendering time for long videos.
- Supports parallel rendering and compositing of multiple video tasks.
- API support for [distributed rendering](#distributed-rendering-solution), enabling the distribution of a large number of videos to multiple devices for rendering and final merging output with minimal wrapping of WVC.
- Supports GPU acceleration for rendering and compositing, reducing video rendering time significantly.
- Can be deployed and run on both Windows and Linux platforms.

<br>

# Supported Animation Libraries

In theory, all web animation/graphics libraries should work smoothly in the WVC environment. Below, I've listed only the libraries that I have verified to be compatible:

[Anime.js](https://animejs.com/) / [GSAP](https://greensock.com/) / [D3.js](https://d3js.org/) / [Three.js](https://threejs.org/) / [Echart](https://echarts.apache.org/) / [Lottie-Web](http://airbnb.io/lottie/#/web) / [PixiJS](https://pixijs.download/release/docs/index.html) / [Animate.css](https://animate.style/) / [Mo.js](https://mojs.github.io/) / [Tween.js](https://tweenjs.github.io/tween.js/)

Please note that if you manually use [RAF](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) to drive animations, ensure that you receive the `timestamp` parameter from the callback to set the animation's progress to that timestamp. Otherwise, frame rate asynchrony may occur.

<br>

# Interesting demo

...

# Quick Start

## Installation

```shell
npm i web-video-creator
```

If you encounter issues with the download of `ffmpeg-static`, please set the environment variable: `FFMPEG_BINARIES_URL=https://cdn.npmmirror.com/binaries/ffmpeg-static`.

## Running Examples

Currently, WVC provides two simple examples demonstrating rendering and compositing of single and multi-scene videos.

### Single Scene Compositing Example

<img style="width:550px" src="./assets/single-video.gif" />

Sample code for calling is located at: [examples/single-video.js](./examples/single-video.js).

```javascript
import { examples, VIDEO_ENCODER } from "web-video-creator";

await examples.singleVideo({
    // URL of the page to render
    url: "http://localhost:8080/test.html",
    // Video width
    width: 1280,
    // Video height
    height: 720,
    // Video frame rate
    fps: 30,
    // Video duration
    duration: 10000,
    // Choose an appropriate encoder based on your hardware. Here, we use the h264_nvenc encoder for Nvidia GPUs.
    // Refer to the options provided in VIDEO_ENCODER for encoder choices.
    videoEncoder: VIDEO_ENCODER.NVIDIA.H264,
    // Video output path
    outputPath: "./test.mp4"
});
```

### Multi-Scene Compositing Example

<img style="width:550px" src="./assets/multi-video.gif" />

Sample code for calling is located at: [examples/multi-video.js](./examples/multi-video.js).

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
        // ...
    ],
    // Video width
    width: 1280,
    // Video height
    height: 720,
    // Video frame rate
    fps: 30,
    // Choose an appropriate encoder based on your hardware. Here, we use the h264_nvenc encoder for Nvidia GPUs.
    // Refer to the options provided in VIDEO_ENCODER for encoder choices.
    videoEncoder: VIDEO_ENCODER.NVIDIA.H264,
    // Video output path
    outputPath: "./test.mp4"
});
```

## Basic Usage

```javascript
import WebVideoCreator, { VIDEO_ENCODER } from "web-video-creator";

const wvc = new WebVideoCreator();

// Configure WVC
wvc.config({
    // Choose an appropriate encoder based on your hardware. Here, we use the h264_nvenc encoder for Nvidia GPUs.
    // Refer to the options provided in VIDEO_ENCODER for encoder choices.
    mp4Encoder: VIDEO_ENCODER.NVIDIA.H264
});

// Create a single scene video
const video = wvc.createSingleVideo({
    // URL of the page to render
    url: "http://localhost:8080/test.html",
    // Video width
    width: 1280,
    // Video height
    height: 720,
    // Video frame rate
    fps: 30,
    // Video duration
    duration: 10000,
    // Video output path
    outputPath: "./test.mp4",
    // Display progress bar in the CLI
    showProgress: true
});

// Listen for the completion event
video.once("completed", result => {
    console.log("Render Completed!!!", result);
});

// Start rendering
video.start();
```

<br>

# Feature Examples

## Inserting Audio

To add audio to your rendered HTML, simply include an `<audio>` element with the desired audio file. You can also set attributes like `loop`, and WVC will automatically include the audio track for looping in the video.

```html
<audio src="bgm.mp3" loop/>
```

You can also set various attributes to control the audio's behavior. These attributes do not always need to be paired, so you can customize them according to your needs.

```html
<!-- Start playing the audio after 3 seconds and stop it at 10 seconds -->
<audio src="bgm.mp3" startTime="3000" endTime="10000"/>
<!-- Loop a segment of the audio from the 5th second to the 15th second -->
<audio src="bgm.mp3" seekStart="5000" seekEnd="15000" loop/>
<!-- Apply a 300ms fade-in and 500ms fade-out to the audio -->
<audio src="bgm.mp3" fadeInDuration="300" fadeOutDuration="500"/>
```

You can also dynamically add and remove `<audio>` elements in your code to control audio entering and exiting the scene. WVC will detect them.

```javascript
const audio = document.createElement("audio");
audio.src = "bgm.mp3";
// Audio enters the scene at 3 seconds
setTimeout(() => document.body.appendChild(audio), 3000);
// Audio exits the scene at 8 seconds
setTimeout(() => audio.remove(), 80000);
```

In many cases, you may prefer not to modify the HTML content. In such cases, you can use `addAudio` to add audio to the video.

```javascript
const video = wvc.createSingleVideo({ ... });
// Add a single audio track
video.addAudio({
    // url: "http://.../bgm.mp3"
    path: "bgm.mp3",
    startTime: 500,
    loop: true
});
// Add multiple audio tracks
video.addAudios([...]);
```

This operation also applies to MultiVideo and ChunkVideo.

## Inserting Video

Currently, WVC supports `mp4` and `webm` video formats. To insert a video into your rendered HTML, include a `<video>` element with the desired video file. You can set attributes like `loop` and `muted`. Be sure to define the width and height through attributes or styles, as the canvas size in WVC is fixed, and otherwise, the video may not be visible.

```html
<video src="background.mp4" loop muted style="width: 1280px; height: 720px"/>
```

If you wish to insert a video with a transparent channel, see: [Transparent Channel Videos](#transparent-channel-videos). If you are interested in video frame rate synchronization or transparent video rendering, you can refer to: [Technical Implementation](#technical-implementation).

Similar to audio, you can set various attributes to control the video's behavior, and these attributes do not always need to be paired.

```html
<!-- Start playing the video after 3 seconds and stop it at 10 seconds -->
<video src="test.mp4" startTime="3000" endTime="10000" style="width: 640px; height: 480px"/>
<!-- Loop a segment of the video from the 5th second to the 15th second -->
<video src="test.mp4" seekStart="5000" seekEnd="15000" loop style="width: 640px; height: 480px"/>
<!-- Apply a 300ms fade-in and 500ms fade-out to the video -->
<video src="test.mp4" fadeInDuration="300" fadeOutDuration="500" style="width: 640px; height: 480px"/>
```

You can dynamically add and remove `<video>` elements in your code to control video entering and exiting the scene. WVC will detect them.

```javascript
const video = document.createElement("video");
video.src = "test.mp4";
video.width = 640;
video.height = 480;
// Video enters the scene at 3 seconds
setTimeout(() => document.body.appendChild(video), 3000);
// Video exits the scene at 8 seconds
setTimeout(() => video.remove(), 8000);
```

### Transparent Channel Videos

Transparent videos are great for compositing digital avatars (e.g., VTubers) into video scenes. In WVC, transparent videos should be in the `webm` format. Internally, they will be re-encoded into two mp4 container videos: one for the color base video and one for the mask video. These videos will be used for blending and drawing using the `globalCompositeOperation` in the browser canvas.

For users, it's seamless. You just need to include a `<video>` element in your HTML with the `src` set to the webm video file.

```html
<video src="vtuber.webm" style="width: 480px; height: 640px"/>
```

Webm encoding and decoding can be time-consuming. If you can obtain the original mp4 video and the mask mp4 video, it's a better solution. Just add the `maskSrc` attribute.

```html
<video src="vtuber.mp4" maskSrc="vtuber_mask.mp4" style="width: 480px; height: 640px"/>
```

## Inserting Animated Images

Animated images refer to sequence frame animations in `gif` / `apng` / `webp` formats. They can naturally play in the browser, but their frame rate is usually uncontrollable. WVC proxies their rendering, replacing `img` elements with `canvas` elements, and uses ImageDecoder to decode and draw each frame in sync with virtual time.

The following animated images can be rendered as well, and you can style them as usual.

```html
<img src="test.gif"/>
<img src="test.apng"/>
<img src="test.webp"/>
```

## Inserting Lottie Animations

WVC comes with the built-in [lottie-web](http://airbnb.io/lottie/#/web) animation library. If you have your own Lottie animations in your web page, they should work seamlessly with WVC.

Simply insert a `<lottie>` element and set the `src` attribute.

```html
<lottie src="example.json"/>
```

## Applying Fonts

WVC can detect `@font-face` declarations in stylesheets and wait for the fonts to load before starting rendering.

```html
<style>
    @font-face {
        font-family: "FontTest";
        src: url("font.ttf") format("truetype");
    }
</style>
<p style='font-family: "FontTest"'>Hello World</p>
```

Alternatively, you can register local or remote fonts through code.

```javascript
const video = wvc.createSingleVideo({ ... });
// Register a single font
video.registerFont({
    // url: "http://.../font.ttf"
    path: "font.ttf",
    family: "FontTest",
    format: "truetype"
});
// Register multiple fonts
video.registerFonts([...]);
```

Make sure the fonts can be loaded; otherwise, rendering may not start.

## Delayed Rendering Start

By default, WVC starts rendering immediately after the page navigation is complete. If you

 want to perform some tasks before rendering, you can disable automatic rendering start in the options. In this case, remember to call `captureCtx.start()` in your page code, or rendering will be blocked indefinitely.

```javascript
const video = wvc.createSingleVideo({
    url: "http://localhost:8080/test.html",
    width: 1280,
    height: 720,
    duration: 10000,
    // Disable automatic rendering start
    autostartRender: false
});
```

In your page code, call the start function when appropriate.

```html
<script>
    // Start rendering after 5 seconds
    setTimeout(() => captureCtx.start(), 5000);
</script>
```

<br>

# Distributed Rendering

If you have multiple devices available for rendering, you can deploy WVC on these devices. WVC provides `MultiVideo` and `ChunkVideo`, allowing you to divide the animation pages into many segments (e.g., 0-10 seconds, 10-20 seconds, etc.). Distribute their parameters to different WVC instances on different devices, create ChunkVideo instances on these devices, and execute parallel rendering to generate multiple video segments (`ts`). These segments are then sent back to the core node, where they are combined, and transitions, audio tracks, and output are handled. **The distribution and return process is not yet implemented in WVC, but it is not difficult, and you can wrap it according to your own scenario. Contributions to WVC are welcome through [PR](https://github.com/Vinlic/WebVideoCreator/pulls)!**

<br>

# API Reference

## High-Level API

In most cases, it is recommended to use the high-level API because it is simple but may be less flexible.

[API Reference High Level](./docs/api-reference-high-level.md)

## Low-Level API

[API Reference Low Level](./docs/api-reference-low-level.md)

<br>

# Performance Tips

Performance is typically influenced by the complexity of animations and media. To improve performance:

- Divide long animations into multiple segments. For instance, you can include a seek parameter with each page URL, load the page, and seek to a specified time to start playing. Then, render and combine them as a multi-video to significantly reduce rendering time for long videos.

- Render more video chunks in parallel. To maximize system resources, select the number of parallel chunks based on the number of CPU threads, assuming your system has sufficient memory.

- CPU clock speed has a significant impact on baseline performance. Consumer-grade CPUs often have high clock speeds, which can lead to better performance.

- Consider using GPU acceleration for rendering and compositing. If your device has a GPU but it's not being utilized, check the configuration settings or report the issue.

- Using an SSD (Solid State Drive) can improve hard disk cache write performance during parallel rendering, reducing rendering time.

- Select the right video hardware encoder. By default, software encoders are used (libx264 for mp4 and libvpx for webm). If you have integrated or discrete graphics, configure the hardware encoders they support.

- Some time may be spent on network file transfers. It's advisable to deploy static file services on the same server or access the file server from a local network.

Here are the performance parameters for my personal computer as a reference:

Operating System: Windows 10 (Better performance on Linux)

CPU: AMD Ryzen 7 3700X (Clock speed 3.6-4.4GHz, 8 cores, 16 threads)

GPU: Nvidia GeForce GTX 1660 SUPER (6GB VRAM, NVENC support)

RAM: 16GB (DDR4 2400MHz)

Video Type: SVG animations + GIFs + Lottie animations

Video Resolution: 1280x720

Video Frame Rate: 30

Video Duration: 300s (5 minutes)

Rendering Time: 61s (1 minute)

Real-Time Rate: 4.844

Parallel Rendering Count: 16

<br>

# Limitations

- Constrained by browser [secure context restrictions](https://w3c.github.io/webappsec-secure-contexts/), WebVideoCreator can only access `localhost` / `127.0.0.1` or domains using HTTPS with valid certificates. For security reasons, it's recommended to use a local static server (e.g., `live-server` is a good choice).

- The headless experimental API on Mac systems may cause crashes and needs to be switched to compatibility rendering mode to run. However, compatibility rendering mode has various issues, so it is not recommended for Mac systems. See [Compatibility Rendering Mode](#compatibility-rendering-mode).

- WebVideoCreator is a pure ESM package and cannot be imported using CommonJS-style `require`. If you still want to use `require` to import it, refer to this [gist](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c) for guidance.

<br>

# Technical Implementation
Work in progress...
