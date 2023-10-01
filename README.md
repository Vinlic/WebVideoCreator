[简体中文](./README.md) | [English](./README.en-US.md)

<p align="center" style="background:#fff">
  <img width="650px" src="./assets/web-video-creator.png" />
</p>

# 简介

WebVideoCreator（简称WVC）是一个基于 Node.js + Puppeteer + FFmpeg 创建视频的框架，它执行确定性的渲染，准确的以目标帧率捕获任何可在HTML5播放动画（CSS3动画/SVG动画/Lottie动画/GIF动画/APNG动画/WEBP动画）以及任何基于时间轴使用RAF驱动的动画（anime.js是一个不错的选择 :D），当然您也可以调皮的使用setInterval或者setTimeout来控制动画，支持嵌入mp4和透明webm视频，还支持音频合成与加载字体。

WVC为您酷炫的动画页面创造了一个虚拟时间环境（也许可以想象成是一个《楚门的世界》），它的主要职责是将一个`不确定性渲染的环境`转化到`确定性渲染的环境`。

## 不确定性的渲染环境

在日常使用中，浏览器在执行动画渲染时并不是“实时同步”的，当系统负载较高时可能出现掉帧导致动画看上去不够平滑，并且为了提高性能浏览器通常会将部分解码/渲染任务交由其它线程处理，这导致动画间时间轴并不同步（video元素是一个典例:P）。这些对于视频渲染是不可靠的，视频的每一帧动画效果应该是确定性的。

## 确定性的渲染环境

对于执行渲染的代码来说它是无感的，一切照常发生，只是时间流速不再是不稳定的，RAF返回的currentTime、setTimeout/setInterval回调的调用时机、Date等，都是根据当前已渲染的进度决定的。除了接管时钟，对于动态图像和内嵌视频这类通常不由开发者控制的媒体，采用了一些实验性的WebCodec API进行了接管。

这一切的前提由Chrome提供的无头实验API支持：[HeadlessExperimental.beginFrame](https://chromedevtools.github.io/devtools-protocol/tot/HeadlessExperimental/#method-beginFrame)

# 特性

相比其它优秀的开源项目，WebVideoCreator有以下特性：

 - 

