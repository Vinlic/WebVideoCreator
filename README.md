[简体中文](./README.md) | [English](./README.en-US.md)

<p align="center" style="background:#fff">
  <img width="650px" src="./assets/web-video-creator.png" />
</p>

# 简介

WebVideoCreator（简称WVC）是一个基于 Node.js + Puppeteer + FFmpeg 创建视频的框架，它执行确定性的渲染，准确的以目标帧率捕获任何可在HTML5播放动画（CSS3动画/SVG动画/Lottie动画/GIF动画/APNG动画/WEBP动画）以及任何基于时间轴使用[RAF](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/requestAnimationFrame)驱动的动画（[anime.js](https://animejs.com/)是一个不错的选择 :D），当然您也可以调皮的使用setInterval或者setTimeout来控制动画，支持嵌入mp4和透明webm视频，还支持转场合成、音频合成与加载字体。让我们[快速开始](#快速开始)。

WVC为您酷炫的动画页面创造了一个虚拟时间环境（也许可以想象成是一个《楚门的世界》），它的主要职责是将一个 **不确定性渲染的环境** 转化到 **确定性渲染的环境**。

### 不确定性的渲染环境

在日常使用中，浏览器在执行动画渲染时并不是“实时同步”的，当系统负载较高时可能出现掉帧导致动画看上去不够平滑，并且为了提高性能浏览器通常会将部分解码/渲染任务交由其它线程处理，这导致动画间时间轴并不同步（video元素是一个典例:P）。这些对于视频渲染是不可靠的，视频的每一帧动画效果应该是确定性的。

### 确定性的渲染环境

对于执行渲染的代码来说它是无感的，一切照常发生，只是时间流速不再不稳定，RAF返回的currentTime、setTimeout/setInterval回调的调用时机、Date、performance.now等，都是根据当前已渲染的进度决定的。除了接管时钟，对于动态图像和内嵌视频这类通常不由开发者控制的媒体，采用了一些实验性的 [WebCodecs API](https://github.com/w3c/webcodecs) 进行了接管。

这一切的前提由Chrome提供的无头实验API支持：[HeadlessExperimental.beginFrame](https://chromedevtools.github.io/devtools-protocol/tot/HeadlessExperimental/#method-beginFrame)

# 特性

 - 基于Node.js开发，使用非常简单，易于扩展和开发。
 - 视频处理速度非常快，最快5分钟视频可在1分钟内完成渲染。
 - 支持单幕和多幕视频渲染合成，多幕视频可应用转场效果。
 - 支持分块视频合成，可以将分块分发到多个设备上渲染回传再合成为多幕视频，大幅降低长视频渲染耗时。
 - 支持并行多个视频渲染合成任务，充分利用系统资源。
 - 支持使用GPU加速渲染和合成，可以显著的降低视频渲染耗时。
 - 支持在Windows和Linux平台部署运行。

# 可用性

理论上所有的Web动画/图形库都能够在WVC环境正常运行，以下仅列出我已验证可用的库：

[Anime.js](https://animejs.com/) / [GSAP](https://greensock.com/) / [D3.js](https://d3js.org/) / [Three.js](https://threejs.org/) / [Echart](https://echarts.apache.org/) / [Lottie-Web](http://airbnb.io/lottie/#/web) / [PixiJS](https://pixijs.download/release/docs/index.html) / [Animate.css](https://animate.style/) / [Mo.js](https://mojs.github.io/) / [Tween.js](https://tweenjs.github.io/tween.js/)

需要注意的是，如果您手动使用[RAF](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/requestAnimationFrame)驱动动画，请确保从回调中接收timestamp参数设置动画的进度到该时间点，否则可能出现帧率不同步。

# 有趣的Demo

正在生产...

# 快速开始

## 安装

```shell
npm i web-video-creator
```
如遇到ffmpeg-static下载失败，请先设置环境变量：`FFMPEG_BINARIES_URL=https://cdn.npmmirror.com/binaries/ffmpeg-static`

## 简单使用

```javascript
import WebVideoCreator, { VIDEO_ENCODER } from "web-video-creator";

const wvc = new WebVideoCreator();

// 配置WVC
wvc.config({
    // 根据您的硬件设备选择适合的编码器，这里采用的是Nvidia显卡的h264_nvenc编码器
    // 编码器选择可参考VIDEO_ENCODER内提供的选项注释
    mp4Encoder: VIDEO_ENCODER.NVIDIA.H264
});

// 创建单幕视频
const video = wvc.createSingleVideo({
    // 需要渲染的页面地址
    url: "http://localhost:8080/test.html",
    // 视频宽度
    width: 1280,
    // 视频高度
    height: 720,
    // 视频帧率
    fps: 30,
    // 视频时长
    duration: 10000,
    // 视频输出路径
    outputPath: "./test.mp4",
    // 是否在cli显示进度条
    showProgress: true
});

// 监听合成完成事件
video.once("completed", result => {
    console.log("Render Completed!!!", result);
});

// 启动合成
video.start();
```

## 单幕合成示例

<img style="width:550px" src="./assets/single-video.gif" />

调用示例代码来自：[examples/single-video.js](./examples/single-video.js)

```javascript
import { examples, VIDEO_ENCODER } from "web-video-creator";

await examples.singleVideo({
    // 需要渲染的页面地址
    url: "http://localhost:8080/test.html",
    // 视频宽度
    width: 1280,
    // 视频高度
    height: 720,
    // 视频帧率
    fps: 30,
    // 视频时长
    duration: 10000,
    // 根据您的硬件设备选择适合的编码器，这里采用的是Nvidia显卡的h264_nvenc编码器
    // 编码器选择可参考VIDEO_ENCODER内提供的选项注释
    videoEncoder: VIDEO_ENCODER.NVIDIA.H264,
    // 视频输出路径
    outputPath: "./test.mp4"
});
```

## 多幕合成示例

<img style="width:550px" src="./assets/multi-video.gif" />

调用示例代码来自：[examples/multi-video.js](./examples/multi-video.js)

```javascript
import { examples, VIDEO_ENCODER, TRANSITION } from "web-video-creator";

await examples.multiVideo({
    // 视频块列表
    chunks: [
        {
            url: "http://localhost:8080/scene1.html",
            duration: 10000,
            // 与下一幕切换时使用圆形裁剪转场
            transition: TRANSITION.CIRCLE_CROP
        },
        {
            url: "http://localhost:8080/scene2.html",
            duration: 10000
        },
        ...
    ],
    // 视频宽度
    width: 1280,
    // 视频高度
    height: 720,
    // 视频帧率
    fps: 30,
    // 根据您的硬件设备选择适合的编码器，这里采用的是Nvidia显卡的h264_nvenc编码器
    // 编码器选择可参考VIDEO_ENCODER内提供的选项注释
    videoEncoder: VIDEO_ENCODER.NVIDIA.H264,
    // 视频输出路径
    outputPath: "./test.mp4"
});
```

# 功能示例

## 插入音频

只需在需要渲染的html中添加 `<audio>` 元素，您还可以设置循环，WVC会自动为视频合入循环音轨。

```html
<audio src="bgm.mp3" loop/>
```

还可以设置一些其它属性控制音频的行为，这些属性并不总是需要成对出现，你可以根据自己的需求定制。

```html
<!-- 控制音频在3秒后开始播放并在10秒处停止播放 -->
<audio src="bgm.mp3" startTime="3000" endTime="10000"/>
<!-- 截取音频第5秒到第15秒的片段并循环播放它 -->
<audio src="bgm.mp3" seekStart="5000" seekEnd="15000" loop/>
<!-- 控制音频300毫秒淡入且500毫秒淡出 -->
<audio src="bgm.mp3" fadeInDuration="300" fadeOutDuration="500"/>
```

在代码中添加和移除 `<audio>` 元素来实现音频出入场也是被允许的，WVC将检测到它们。

```javascript
const audio = document.createElement("audio");
audio.src = "bgm.mp3";
// 音频在视频第5秒入场
setTimeout(() => document.body.appendChild(audio), 5000);
// 音频在视频第10秒出场
setTimeout(() => audio.remove(), 10000);
```

许多时候您可能并不希望侵入修改html内容，可以使用 `addAudio` 将音频添加到视频中。

```javascript
const video = wvc.createSingleVideo({ ... });
video.addAudio({
    // url: "http://.../bgm.mp3"
    path: "bgm.mp3",
    startTime: 500,
    loop: true
});
```

这样的操作同样适用于 MultiVideo 和 ChunkVideo 。

## 插入视频

目前支持 `mp4` 和 `webm` 格式的视频，如果希望插入透明通道的视频请见：[透明通道视频](#透明通道视频)

只需在需要渲染的html中添加 `<video>` 元素，您可以设置循环和静音，请务必为通过属性或样式设置元素宽高，因为在WVC中画布的大小是确定的，否则可能不可见。

```html
<video src="background.mp4" loop muted style="width: 1280px; height: 720px"/>
```

和音频一样，它也支持设置一些属性控制视频的行为，这些属性并不总是需要成对出现，你可以根据自己的需求定制。

```html
<!-- 控制视频在3秒后开始播放并在10秒处停止播放 -->
<video src="test.mp4" startTime="3000" endTime="10000" style="width: 640px; height: 480px"/>
<!-- 截取视频第5秒到第15秒的片段并循环播放它 -->
<video src="test.mp4" seekStart="5000" seekEnd="15000" loop style="width: 640px; height: 480px"/>
<!-- 控制视频的音频在300毫秒淡入且500毫秒淡出 -->
<video src="test.mp4" fadeInDuration="300" fadeOutDuration="500" style="width: 640px; height: 480px"/>
```

在代码中添加和移除 `<video>` 元素来实现音频出入场也是被允许的，WVC将检测到它们。

```javascript
const audio = document.createElement("video");
video.src = "test.mp4";
video.width = 640;
video.height = 480;
// 视频在第5秒入场
setTimeout(() => document.body.appendChild(video), 5000);
// 视频在第10秒出场
setTimeout(() => video.remove(), 10000);
```

### 透明通道视频

透明视频非常适合用于将vtuber数字人合成到视频画面中，结合精美的动画可以获得非常好的观看体验。

透明通道视频格式需为 `webm` ，它会被重新编码为两个mp4容器的视频，分别是原色底视频和蒙版视频后在浏览器canvas中使用进行 `globalCompositeOperation` 进行图像混合。如果您拥有原始mp4视频+蒙版mp4视频也可以直接提供进行合成。

同样的，只需在需要渲染的html中添加 `<video>` 元素，并设置webm格式视频。

```html
<video src="vtuber.webm" style="width: 480px; height: 640px"/>
```

webm编解码通常比较耗时，如果您可以直接获得原始mp4视频和蒙版mp4视频是更好的方案，只需增加设置maskSrc即可。

```html
<video src="vtuber.mp4" maskSrc="vtuber_mask.mp4" style="width: 480px; height: 640px"/>
```

## 应用字体





# API参考


# 性能提示

性能通常受动画和媒体的复杂程度影响，您可以将长时间动画分为多个分段动画播放，比如为每个页面地址带一个seek参数，加载页面后seek到指定时间点开始播放，然后作为多幕视频进行渲染合成，可以显著的降低长视频的渲染耗时。

- 并行更多的视频块渲染，如果希望榨干系统资源，在确保系统内存充足的情况下并行数选定为CPU的线程数
- CPU主频对于基准速度影响较大，通常消费级CPU主频很高，可以获得更佳的性能。
- 建议使用GPU加速渲染和合成，如果您设备有GPU但没有被使用，请检查配置项或报告问题。
- 采用SSD（固态硬盘）可以提升并行渲染时的硬盘缓存写入性能从而降低渲染耗时。
- 选择正确的视频硬编码器很重要，默认采用的是软编码器（mp4是libx264，webm是vp8），如果您有核显或者独显请记得配置他们支持的硬编码器。
- 有些耗时可能来自于网络文件传输，建议将静态文件服务部署于同一台服务器或从局域网访问文件服务器。

---

目前手上没有更好的测试设备，我将以我的个人主机的性能参数作为参考：

CPU: AMD Ryzen 7 3700X（主频3.6-4.4GHz 8核16线程）

GPU: Nvidia GeForce GTX 1660 SUPER（6GB显存 支持NVENC）

RAM: 16GB（DDR4 2400MHz）

视频类型：SVG动画+GIF+Lottie动画播放

视频分辨率：1280x720

视频帧率：30

视频时长：300s（5分钟）

渲染耗时：61s（1分钟）

实时率：4.844

并行渲染数：16

---

# 局限性

- 受制于浏览器的[安全上下文限制](https://w3c.github.io/webappsec-secure-contexts/)，只能访问 localhost / 127.0.0.1 或者使用HTTPS协议且证书有效的域，从安全角度考虑建议使用本机静态服务器（live-server是一个不错的选择）。
- 暂时不支持在MAC系统中部署，因为无头实验API在那上面会发生崩溃。
- WebVideoCreator是纯ESM包，无法使用CommonJS风格引入，如果依然希望使用require引入，请参考：https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c