# 低级别 API

```javascript
import { core } from "web-video-creator"
// 低级API在core暴露
const { ... } = core;
```

# ResourcePool

资源池

## 构造函数

### new ResourcePool(options)

#### options 参数

<table width="100%">
    <thead>
        <tr>
            <th>参数</th>
            <th>类型</th>
            <th>说明</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>numBrowserMin</td>
            <td>number</td>
            <td>资源池最小浏览器实例数量</td>
        </tr>
        <tr>
            <td>numBrowserMax</td>
            <td>number</td>
            <td>资源池最大浏览器实例数量</td>
        </tr>
        <tr>
            <td>browserOptions</td>
            <td>Object</td>
            <td>浏览器选项，参考 <<a href="#browser">Browser</a> 构造函数的options参数</td>
        </tr>
        <tr>
            <td>browserOptions.pageOptions</td>
            <td>Object</td>
            <td>浏览器页面选项，参考 <a href="#page">Page</a> 构造函数的options参数</td>
        </tr>
    </tbody>
</table>

## 成员

### ResourcePool.warmup(): Promise

预热资源池，当渲染任务产生时可以快速启动渲染。

### ResourcePool.acquirePage(): Promise<[Page](#page)>

从资源池获取一个页面封装实例，请记得 page 对象使用完毕后调用 [page.release()](#pagerelease-promise) 释放它。

### ResourcePool.acquireBrowser(): Promise<[Browser](#browser)>

从资源池获取一个浏览器封装实例，请记得 browser 对象使用完毕后调用 [browser.release()](#browserrelease-promise) 释放它。

### ResourcePool.isBusy(): boolean

判断浏览器资源池是否饱和

<br>

# Browser

浏览器封装

## 构造函数

### new Browser(options)

#### options 参数

<table width="100%">
    <thead>
        <tr>
            <th>参数</th>
            <th>类型</th>
            <th>说明</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>numPageMin</td>
            <td>number</td>
            <td>页面资源最小数量</td>
        </tr>
        <tr>
            <td>numPageMax</td>
            <td>number</td>
            <td>页面资源最大数量</td>
        </tr>
        <tr>
            <td>executablePath</td>
            <td>string</td>
            <td>浏览器可执行文件路径</td>
        </tr>
        <tr>
            <td>useGPU</td>
            <td>boolean</td>
            <td>是否使用GPU加速渲染，建议开启</td>
        </tr>
        <tr>
            <td>useAngle</td>
            <td>boolean</td>
            <td>渲染后端是否使用Angle，建议开启</td>
        </tr>
        <tr>
            <td>disableDevShm</td>
            <td>boolean</td>
            <td>是否禁用共享内存，当/dev/shm较小时建议开启此选项，默认关闭</td>
        </tr>
        <tr>
            <td>args</td>
            <td>string[]</td>
            <td>浏览器flags参数列表</td>
        </tr>
        <tr>
            <td>pageOptions</td>
            <td>Object</td>
            <td>页面选项，参考 <a href="#page">Page</a> 构造函数的options参数</td>
        </tr>
    </tbody>
</table>

## 成员

### Browser.init(): Promise

初始化浏览器

### Browser.acquirePage(): Promise<[Page](#page)>

从浏览器封装获取一个页面封装实例，请记得 page 对象使用完毕后调用 [page.release()](#pagerelease-promise) 释放它。

### Browser.release(): Promise

释放浏览器封装自身，将被回收到资源池进行下一次分配。

### Browser.close(): Promise

关闭浏览器，将通知资源池销毁浏览器资源

### Browser.getPageCount(): Promise<number>

获取浏览器已开启的页面数量

### Browser.isUninitialized(): boolean

判断浏览器是否未初始化

### Browser.isReady(): boolean

判断浏览器是否已就绪

### Browser.isUnavailabled(): boolean

判断浏览器是否不可用

### Browser.isClosed(): boolean

判断浏览器是否已关闭

### Browser.isBusy(): boolean

判断浏览器页面池是否饱和

<br>

# Page

页面封装

## 构造函数

### new Page(options)

#### options 参数

<table width="100%">
    <thead>
        <tr>
            <th>参数</th>
            <th>类型</th>
            <th>说明</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>width</td>
            <td>number</td>
            <td>页面初始化视窗宽度，可通过setViewport调整</td>
        </tr>
        <tr>
            <td>height</td>
            <td>number</td>
            <td>页面初始化视窗高度，可通过setViewport调整</td>
        </tr>
        <tr>
            <td>userAgent</td>
            <td>string</td>
            <td>访问页面时的用户UA</td>
        </tr>
        <tr>
            <td>beginFrameTimeout</td>
            <td>number</td>
            <td>BeginFrame超时时间（毫秒），默认5000毫秒</td>
        </tr>
        <tr>
            <td>frameFormat</td>
            <td>string</td>
            <td>帧图格式（jpeg/png），建议使用jpeg提高性能</td>
        </tr>
        <tr>
            <td>frameQuality</td>
            <td>number</td>
            <td>帧图质量（0-100），默认80</td>
        </tr>
    </tbody>
</table>

## 成员

### Page.init(): Promise

初始化页面

### Page.setViewport(options): Promise

设置视窗参数

#### options 参数

<table width="100%">
    <thead>
        <tr>
            <th>参数</th>
            <th>类型</th>
            <th>说明</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>width</td>
            <td>number</td>
            <td>页面视窗宽度</td>
        </tr>
        <tr>
            <td>height</td>
            <td>number</td>
            <td>页面视窗高度</td>
        </tr>
        <tr>
            <td>deviceScaleFactor</td>
            <td>number</td>
            <td>设备缩放因子</td>
        </tr>
    </tbody>
</table>

### goto(url): Promise

导航到待渲染页面。

#### url 参数

本地 URL 或远端 HTTPS URL，受制于浏览器的[安全上下文限制](https://w3c.github.io/webappsec-secure-contexts/)，只能访问 localhost / 127.0.0.1 或者使用 HTTPS 协议且证书有效的域

### Page.registerFont(options)

注册字体

#### options 参数

参考 [Font](#font) 字体参数。

### Page.registerFonts([options, ...])

注册多个字体

#### options 参数

参考 [Font](#font) 字体参数。

### Page.waitForFontsLoaded(timeout): Promise

等待字体加载完成。

#### timeout 参数

超时时间（毫秒），默认 30000 毫秒

### Page.startScreencast(options): Promise

开始帧图流捕获

#### options 参数

<table width="100%">
    <thead>
        <tr>
            <th>参数</th>
            <th>类型</th>
            <th>说明</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>fps</td>
            <td>number</td>
            <td>渲染帧率</td>
        </tr>
        <tr>
            <td>duration</td>
            <td>number</td>
            <td>渲染时长（毫秒）</td>
        </tr>
        <tr>
            <td>frameCount</td>
            <td>number</td>
            <td>渲染总帧数</td>
        </tr>
        <tr>
            <td>autostart</td>
            <td>boolean</td>
            <td>是否自动启动渲染，默认true</td>
        </tr>
    </tbody>
</table>

### Page.pauseScreencast(): Promise

暂停帧图流捕获

### Page.resumeScreencast(): Promise

恢复帧图流捕获

### Page.stopScreencast(): Promise

停止帧图流捕获

### Page.getCaptureContextConfig(): Promise

获取页面中全局的 `captureCtx.config` 配置内容。

### Page.reset(): Promise

重置页面封装，重置后可开始新的捕获。

### Page.release(): Promise

释放页面封装自身，将被回收到页面池进行下一次分配。

### Page.close(): Promise

关闭页面，将通知浏览器封装销毁页面资源

### Page.isUninitialized(): boolean

判断页面是否未初始化

### Page.isReady(): boolean

判断页面是否已就绪

### Page.isUnavailabled(): boolean

判断页面是否不可用

### Page.isClosed(): boolean

判断页面是否已关闭

<br>

# Synthesizer

合成器

## 构造函数

### new Synthesizer(options)

#### options 参数

<table width="100%">
    <thead>
        <tr>
            <th>参数</th>
            <th>类型</th>
            <th>说明</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>outputPath</td>
            <td>string</td>
            <td>导出视频路径</td>
        </tr>
        <tr>
            <td>width</td>
            <td>number</td>
            <td>视频宽度</td>
        </tr>
        <tr>
            <td>height</td>
            <td>number</td>
            <td>视频高度</td>
        </tr>
        <tr>
            <td>duration</td>
            <td>number</td>
            <td>视频时长</td>
        </tr>
        <tr>
            <td>fps</td>
            <td>number</td>
            <td>视频合成帧率，默认30</td>
        </tr>
        <tr>
            <td>format</td>
            <td>string</td>
            <td>导出视频格式（mp4/webm），默认通过输出文件路径后缀判断</td>
        </tr>
        <tr>
            <td>attachCoverPath</td>
            <td>string</td>
            <td>附加到视频首帧的封面路径</td>
        </tr>
        <tr>
            <td>coverCapture</td>
            <td>boolean</td>
            <td>是否捕获封面并输出，默认false</td>
        </tr>
        <tr>
            <td>coverCaptureTime</td>
            <td>number</td>
            <td>封面捕获时间点（毫秒），默认捕获时间点是视频的20%位置</td>
        </tr>
        <tr>
            <td>coverCaptureFormat</td>
            <td>string</td>
            <td>封面捕获格式（jpg/png/bmp），默认jpg</td>
        </tr>
        <tr>
            <td>videoEncoder</td>
            <td>string</td>
            <td>视频编码器，编码器选择请参考 <a href="./video-encoder.md">视频编码器列表</a></td>
        </tr>
        <tr>
            <td>videoQuality</td>
            <td>number</td>
            <td>视频质量（0-100），默认100</td>
        </tr>
        <tr>
            <td>videoBitrate</td>
            <td>string</td>
            <td>视频码率（设置码率将忽略videoQuality）</td>
        </tr>
        <tr>
            <td>pixelFormat</td>
            <td>string</td>
            <td>像素格式（yuv420p/yuv444p/rgb24），默认yuv420p</td>
        </tr>
        <tr>
            <td>audioEncoder</td>
            <td>string</td>
            <td>音频编码器，默认aac</td>
        </tr>
        <tr>
            <td>audioBitrate</td>
            <td>string</td>
            <td>音频码率</td>
        </tr>
        <tr>
            <td>volume</td>
            <td>number</td>
            <td>视频音量（0-100），默认100</td>
        </tr>
        <tr>
            <td>parallelWriteFrames</td>
            <td>number</td>
            <td>并行写入帧数，默认10</td>
        </tr>
        <tr>
            <td>showProgress</td>
            <td>boolean</td>
            <td>是否在命令行展示进度，默认false</td>
        </tr>
    </tbody>
</table>

### Synthesizer.start()

启动合成。

### Synthesizer.abort()

终止合成，非特殊情况一般不要中断渲染。

### Synthesizer.input(buffer)

输入帧数据。

#### buffer 参数

使用 Buffer 对象存储的帧图二进制数据，输入后将流式传输到 FFmpeg。

### Synthesizer.endInput()

结束帧图流的输入，通知 FFmpeg 所有帧已经输入完成等待合成完成。

### Synthesizer.addAudio(options)

添加音频。

#### options 参数

参考 [Audio](#audio) 音频参数。

### Synthesizer.addAudios([options, ...])

添加多个音频

#### options 参数

参考 [Audio](#audio) 音频参数。

### Synthesizer.removeOutputFile(): Promise

移除输出文件。

### Synthesizer.reset()

重置合成器，重置后可以重新输入帧。

### Synthesizer.isReady(): boolean

合成器是否已就绪

### Synthesizer.isSynthesizing(): boolean

合成器是否正在合成中

### Synthesizer.isCompleted(): boolean

合成器是否已经合成完成

<br>

# VideoChunk

视频块

## 构造函数

### new VideoChunk(options)

#### options 参数

<table width="100%">
    <thead>
        <tr>
            <th>参数</th>
            <th>类型</th>
            <th>说明</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>width</td>
            <td>number</td>
            <td>视频宽度</td>
        </tr>
        <tr>
            <td>height</td>
            <td>number</td>
            <td>视频高度</td>
        </tr>
        <tr>
            <td>duration</td>
            <td>number</td>
            <td>视频时长</td>
        </tr>
        <tr>
            <td>fps</td>
            <td>number</td>
            <td>视频合成帧率，默认30</td>
        </tr>
        <tr>
            <td>outputPath</td>
            <td>string</td>
            <td>导出视频分块路径，默认存储在临时目录，路径必须使用.ts后缀</td>
        </tr>
        <tr>
            <td>transition</td>
            <td>string | <a href="#transition">Transition</a></td>
            <td>进入下一视频分块的转场</td>
        </tr>
        <tr>
            <td>autoremove</td>
            <td>boolean</td>
            <td>分块被合并后是否自动删除分块文件，默认true</td>
        </tr>
        <tr>
            <td>videoEncoder</td>
            <td>string</td>
            <td>视频编码器，编码器选择请参考 <a href="./video-encoder.md">视频编码器列表</a></td>
        </tr>
        <tr>
            <td>videoQuality</td>
            <td>number</td>
            <td>视频质量（0-100），默认100</td>
        </tr>
        <tr>
            <td>videoBitrate</td>
            <td>string</td>
            <td>视频码率（设置码率将忽略videoQuality）</td>
        </tr>
        <tr>
            <td>pixelFormat</td>
            <td>string</td>
            <td>像素格式（yuv420p/yuv444p/rgb24），默认yuv420p</td>
        </tr>
        <tr>
            <td>parallelWriteFrames</td>
            <td>number</td>
            <td>并行写入帧数，默认10</td>
        </tr>
        <tr>
            <td>showProgress</td>
            <td>boolean</td>
            <td>是否在命令行展示进度，默认false</td>
        </tr>
    </tbody>
</table>

### VideoChunk.start()

启动合成。

### VideoChunk.abort()

终止合成，非特殊情况一般不要中断渲染。

### VideoChunk.input(buffer)

输入帧数据。

#### buffer 参数

使用 Buffer 对象存储的帧图二进制数据，输入后将流式传输到 FFmpeg。

### VideoChunk.endInput()

结束帧图流的输入，通知 FFmpeg 所有帧已经输入完成等待合成完成。

### VideoChunk.addAudio(options)

添加音频。

#### options 参数

参考 [Audio](#audio) 音频参数。

### VideoChunk.addAudios([options, ...])

添加多个音频

### VideoChunk.setTransition(options)

设置转场效果

#### options 参数

参考 [Transition](#transition) 转场参数。

### VideoChunk.reset()

重置视频分块，重置后可以重新输入帧。

### VideoChunk.isReady(): boolean

视频分块是否已就绪

### VideoChunk.isSynthesizing(): boolean

视频分块是否正在合成中

### VideoChunk.isCompleted(): boolean

视频分块是否已经合成完成

<br>

# ChunkSynthesizer

视频分块合成器

## 构造函数

### new ChunkSynthesizer(options)

#### options 参数

<table width="100%">
    <thead>
        <tr>
            <th>参数</th>
            <th>类型</th>
            <th>说明</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>outputPath</td>
            <td>string</td>
            <td>导出视频路径</td>
        </tr>
        <tr>
            <td>width</td>
            <td>number</td>
            <td>视频宽度</td>
        </tr>
        <tr>
            <td>height</td>
            <td>number</td>
            <td>视频高度</td>
        </tr>
        <tr>
            <td>chunks</td>
            <td><a href="#videochunk">VideoChunk</a>[]</td>
            <td>未渲染或已渲染的VideoChunk列表，可以是VideoChunk实例也可以是普通对象</td>
        </tr>
        <tr>
            <td>duration</td>
            <td>number</td>
            <td>视频时长</td>
        </tr>
        <tr>
            <td>fps</td>
            <td>number</td>
            <td>视频合成帧率，默认30</td>
        </tr>
        <tr>
            <td>attachCoverPath</td>
            <td>string</td>
            <td>附加到视频首帧的封面路径</td>
        </tr>
        <tr>
            <td>coverCapture</td>
            <td>boolean</td>
            <td>是否捕获封面并输出，默认false</td>
        </tr>
        <tr>
            <td>coverCaptureTime</td>
            <td>number</td>
            <td>封面捕获时间点（毫秒），默认捕获时间点是视频的20%位置</td>
        </tr>
        <tr>
            <td>coverCaptureFormat</td>
            <td>string</td>
            <td>封面捕获格式（jpg/png/bmp），默认jpg</td>
        </tr>
        <tr>
            <td>videoEncoder</td>
            <td>string</td>
            <td>视频编码器，编码器选择请参考 <a href="./video-encoder.md">视频编码器列表</a></td>
        </tr>
        <tr>
            <td>videoQuality</td>
            <td>number</td>
            <td>视频质量（0-100），默认100</td>
        </tr>
        <tr>
            <td>videoBitrate</td>
            <td>string</td>
            <td>视频码率（设置码率将忽略videoQuality）</td>
        </tr>
        <tr>
            <td>pixelFormat</td>
            <td>string</td>
            <td>像素格式（yuv420p/yuv444p/rgb24），默认yuv420p</td>
        </tr>
        <tr>
            <td>audioEncoder</td>
            <td>string</td>
            <td>音频编码器，默认aac</td>
        </tr>
        <tr>
            <td>audioBitrate</td>
            <td>string</td>
            <td>音频码率</td>
        </tr>
        <tr>
            <td>volume</td>
            <td>number</td>
            <td>视频音量（0-100），默认100</td>
        </tr>
        <tr>
            <td>parallelWriteFrames</td>
            <td>number</td>
            <td>并行写入帧数，默认10</td>
        </tr>
        <tr>
            <td>showProgress</td>
            <td>boolean</td>
            <td>是否在命令行展示进度，默认false</td>
        </tr>
    </tbody>
</table>

### ChunkSynthesizer.start()

启动合成。

### ChunkSynthesizer.abort()

终止合成，非特殊情况一般不要中断渲染。

### ChunkSynthesizer.input(chunk, transition)

输入视频分块。

#### chunk 参数

请参考 [VideoChunk](#videochunk) 。

#### transition 参数

请参考 [Transition](#transition) 。

### ChunkSynthesizer.addAudio(options)

添加音频。

#### options 参数

参考 [Audio](#audio) 音频参数。

### ChunkSynthesizer.addAudios([options, ...])

添加多个音频

### ChunkSynthesizer.reset()

重置合成器，重置后可以重新输入视频分块。

### ChunkSynthesizer.isReady(): boolean

合成器是否已就绪

### ChunkSynthesizer.isSynthesizing(): boolean

合成器是否正在合成中

### ChunkSynthesizer.isCompleted(): boolean

合成器是否已经合成完成

# Audio

音频参数

<table width="100%">
    <thead >
        <tr>
            <th>参数</th>
            <th>类型</th>
            <th>说明</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>url</td>
            <td>string</td>
            <td>音频URL，与path二选一</td>
        </tr>
        <tr>
            <td>path</td>
            <td>string</td>
            <td>音频本地路径，与url二选一</td>
        </tr>
        <tr>
            <td>startTime</td>
            <td>number</td>
            <td>起始时间点（毫秒）</td>
        </tr>
        <tr>
            <td>endTime</td>
            <td>number</td>
            <td>结束时间点（毫秒）</td>
        </tr>
        <tr>
            <td>loop</td>
            <td>boolean</td>
            <td>是否循环播放</td>
        </tr>
        <tr>
            <td>volume</td>
            <td>number</td>
            <td>音量（0-100）</td>
        </tr>
        <tr>
            <td>seekStart</td>
            <td>number</td>
            <td>裁剪起始时间点（毫秒）</td>
        </tr>
        <tr>
            <td>seekEnd</td>
            <td>number</td>
            <td>裁剪结束实际点（毫秒）</td>
        </tr>
        <tr>
            <td>fadeInDuration</td>
            <td>number</td>
            <td>淡入时长（毫秒）</td>
        </tr>
        <tr>
            <td>fadeOutDuration</td>
            <td>number</td>
            <td>淡出时长（毫秒）</td>
        </tr>
        <tr>
            <td>retryFetchs</td>
            <td>number</td>
            <td>重试拉取次数</td>
        </tr>
        <tr>
            <td>ignoreCache</td>
            <td>boolean</td>
            <td>是否忽略本地缓存</td>
        </tr>
    </tbody>
</table>

# Transition

转场参数，请参考 [转场效果](./transition.md) 。

<table width="100%">
    <thead >
        <tr>
            <th>参数</th>
            <th>类型</th>
            <th>说明</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>id</td>
            <td>string</td>
            <td>转场ID（与滤镜名称一致）</td>
        </tr>
        <tr>
            <td>duration</td>
            <td>string</td>
            <td>转场时长（毫秒）</td>
        </tr>
    </tbody>
</table>

# Font

字体参数

<table width="100%">
    <thead >
        <tr>
            <th>参数</th>
            <th>类型</th>
            <th>说明</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>url</td>
            <td>string</td>
            <td>字体URL，与path二选一</td>
        </tr>
        <tr>
            <td>path</td>
            <td>string</td>
            <td>字体本地路径，与url二选一</td>
        </tr>
        <tr>
            <td>family</td>
            <td>string</td>
            <td>字体集名称</td>
        </tr>
        <tr>
            <td>style</td>
            <td>string</td>
            <td>字体样式</td>
        </tr>
        <tr>
            <td>weight</td>
            <td>number | string</td>
            <td>字体粗细</td>
        </tr>
        <tr>
            <td>format</td>
            <td>string</td>
            <td>字体格式</td>
        </tr>
        <tr>
            <td>retryFetchs</td>
            <td>number</td>
            <td>重试拉取次数</td>
        </tr>
        <tr>
            <td>ignoreCache</td>
            <td>boolean</td>
            <td>是否忽略本地缓存</td>
        </tr>
    </tbody>
</table>
