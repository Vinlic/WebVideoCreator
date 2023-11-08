# 高级别API

# WebVideoCreator

### WebVideoCreator.config([options: Object])

配置 WVC 的全局开关和属性，在任何操作之前都必须运行它。

#### options 参数

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
            <td>debug</td>
            <td>boolean</td>
            <td>WebVideoCreator调试日志，开启后将输出一些内部的调试日志</td>
        </tr>
        <tr>
            <td>browserDebug</td>
            <td>boolean</td>
            <td>浏览器Debug开关，开启后将输出浏览器的运行日志，如果你想看页面的日志，请设置consoleLog为true，而不是这个</td>
        </tr>
        <tr>
            <td>ffmpegDebug</td>
            <td>boolean</td>
            <td>开启后将输出每一条执行的ffmpeg命令</td>
        </tr>
        <tr>
            <td>ffmpegExecutablePath</td>
            <td>string</td>
            <td>ffmpeg可执行文件路径，设置后将禁用内部的ffmpeg-static，建议您默认使用内部的FFmpeg以确保功能完整性</td>
        </tr>
        <tr>
            <td>ffprobeExecutablePath</td>
            <td>string</td>
            <td>ffprobe可执行文件路径，设置后将禁用内部的ffprobe-static，建议您默认使用内部的ffprobe以确保功能完整性</td>
        </tr>
        <tr>
            <td>browserUseGPU</td>
            <td>boolean</td>
            <td>浏览器GPU加速开关，建议开启提高渲染性能，如果您没有GPU设备或遭遇了诡异的渲染问题则可以关闭它</td>
        </tr>
        <tr>
            <td>browserUseAngle</td>
            <td>boolean</td>
            <td>浏览器是否使用Angle作为渲染后端，默认开启增强渲染跨平台兼容性和性能</td>
        </tr>
        <tr>
            <td>browserDisableDevShm</td>
            <td>boolean</td>
            <td>是否禁用浏览器使用共享内存，当/dev/shm较小时建议开启此选项</td>
        </tr>
        <tr>
            <td>browserExecutablePath</td>
            <td>string</td>
            <td>浏览器可执行文件路径，设置后将禁用内部的浏览器，建议您默认使用内部的浏览器以确保功能完整性</td>
        </tr>
        <tr>
            <td>allowUnsafeContext</td>
            <td>boolean</td>
            <td>默认禁用，开启后能够导航到不安全的URL，但由于不安全上下文限制，将无法在页面中使用动态图像和内嵌视频</td>
        </tr>
        <tr>
            <td>compatibleRenderingMode</td>
            <td>boolean</td>
            <td>兼容渲染模式，不建议启用，启用后将禁用HeadlessExperimental.beginFrame API调用改为普通的Page.screenshot，这会导致渲染性能下降，且部分动画可能帧率无法同步，当你遭遇下面错误的时候可以尝试开启它：TargetCloseError: Protocol error (HeadlessExperimental.beginFrame): Target closed</td>
        </tr>
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
            <td>numPageMin</td>
            <td>number</td>
            <td>浏览器实例最小页面实例数量</td>
        </tr>
        <tr>
            <td>numPageMax</td>
            <td>number</td>
            <td>浏览器实例最大页面实例数量</td>
        </tr>
        <tr>
            <td>userAgent</td>
            <td>string</td>
            <td>访问页面时的用户UA</td>
        </tr>
        <tr>
            <td>frameQuality</td>
            <td>number</td>
            <td>捕获帧图质量（0-100）仅jpeg有效</td>
        </tr>
        <tr>
            <td>frameFormat</td>
            <td>string</td>
            <td>帧图格式（jpeg/png）建议使用jpeg，png捕获较为耗时</td>
        </tr>
        <tr>
            <td>beginFrameTimeout</td>
            <td>number</td>
            <td>BeginFrame捕获图像超时时间（毫秒）</td>
        </tr>
        <tr>
            <td>mp4Encoder</td>
            <td>string</td>
            <td>全局MP4格式的视频编码器，默认使用libx264软编码器，建议根据您的硬件选用合适的硬编码器加速合成</td>
        </tr>
        <tr>
            <td>webmEncoder</td>
            <td>string</td>
            <td>全局WEBM格式的视频编码器，默认使用libvpx软编码器，建议根据您的硬件选用合适的硬编码器加速合成</td>
        </tr>
        <tr>
            <td>audioEncoder</td>
            <td>string</td>
            <td>全局音频编码器，建议采用默认的aac编码器</td>
        </tr>
    </tbody>
</table>

<br>

### WebVideoCreator.createSingleVideo(options: Object): [SingleVideo](#singlevideo)

创建单幕视频实例

#### options 参数

参考 [SingleVideo](#singlevideo) 构造函数的options参数。

<br>

### WebVideoCreator.createMultiVideo(options: Object): [MultiVideo](#multivideo)

创建多幕视频实例

#### options 参数

参考 [MultiVideo](#multivideo) 构造函数的options参数。

<br>

### WebVideoCreator.createChunkVideo(options: Object): [ChunkVideo](#chunkvideo)

创建分块视频实例

#### options 参数

参考 [ChunkVideo](#chunkVideo) 构造函数的options参数。

<br>

# SingleVideo

单幕视频

## 构造函数

### new SingleVideo(options: Object)

#### options 参数

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
            <td>待渲染的页面URL</td>
        </tr>
        <tr>
            <td>outputPath</td>
            <td>string</td>
            <td>视频输出路径</td>
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
            <td>视频帧率</td>
        </tr>
        <tr>
            <td>format</td>
            <td>string</td>
            <td>导出视频格式（mp4/webm）</td>
        </tr>
        <tr>
            <td>attachCoverPath</td>
            <td>string</td>
            <td>附加到视频首帧的封面文件路径</td>
        </tr>
        <tr>
            <td>coverCapture</td>
            <td>boolean</td>
            <td>是否捕获封面并输出</td>
        </tr>
        <tr>
            <td>coverCaptureTime</td>
            <td>number</td>
            <td>封面捕获时间点（毫秒）</td>
        </tr>
        <tr>
            <td>coverCaptureFormat</td>
            <td>string</td>
            <td>封面捕获格式（jpg/png/bmp）</td>
        </tr>
        <tr>
            <td>videoEncoder</td>
            <td>string</td>
            <td>视频编码器，详见 <a href="./video-encoder.md">视频编码器说明</a></td>
        </tr>
        <tr>
            <td>videoQuality</td>
            <td>number</td>
            <td>视频质量（0-100）</td>
        </tr>
        <tr>
            <td>videoBitrate</td>
            <td>string</td>
            <td>视频码率（设置码率将忽略videoQuality）</td>
        </tr>
        <tr>
            <td>pixelFormat</td>
            <td>string</td>
            <td>像素格式（yuv420p/yuv444p/rgb24）</td>
        </tr>
        <tr>
            <td>audioEncoder</td>
            <td>string</td>
            <td>音频编码器，建议默认aac</td>
        </tr>
        <tr>
            <td>audioBitrate</td>
            <td>string</td>
            <td>音频码率</td>
        </tr>
        <tr>
            <td>volume</td>
            <td>number</td>
            <td>视频音量（0-100）</td>
        </tr>
        <tr>
            <td>pageWaitForOptions</td>
            <td><a href="https://pptr.dev/api/puppeteer.waitforoptions">WaitForOptions</a></td>
            <td>页面等待选项</td>
        </tr>
        <tr>
            <td>pagePrepareFn</td>
            <td>Function</td>
            <td>页面预处理函数，可以在渲染之前对Page对象操作</td>
        </tr>
        <tr>
            <td>showProgress</td>
            <td>boolean</td>
            <td>是否在命令行展示进度</td>
        </tr>
        <tr>
            <td>autostartRender</td>
            <td>boolean</td>
            <td>是否自动启动渲染，如果为false请务必在页面中执行 <a href="./capture-ctx.md#capturecontextstart">captureCtx.start()</a></td>
        </tr>
        <tr>
            <td>consoleLog</td>
            <td>boolean</td>
            <td>是否开启控制台日志输出</td>
        </tr>
        <tr>
            <td>videoPreprocessLog</td>
            <td>boolean</td>
            <td>是否开启视频预处理日志输出</td>
        </tr>
        <tr>
            <td>parallelWriteFrames</td>
            <td>number</td>
            <td>并行写入流的帧数</td>
        </tr>
    </tbody>
</table>

## 事件

### progress

合成进度事件，回调参数：(progress, processedFrameCount, totalFrameCount)

### completed

已完成合成事件，回调参数：(result)

### error

错误事件，回调参数：（err）

## 成员

### SingleVideo.registerFont(options: Object)

注册字体

#### options 参数

参考 [Font](#font) 字体参数。

### SingleVideo.registerFonts([options: Object, ...])

注册多个字体

#### options 参数

参考 [Font](#font) 字体参数。

### SingleVideo.addAudio(options: Object)

添加音频

#### options 参数

参考 [Audio](#audio) 音频参数。

### SingleVideo.addAudios([options: Object, ...])

添加多个音频

#### options 参数

参考 [Audio](#audio) 音频参数。

### SingleVideo.start()

启动单幕渲染合成

### SingleVideo.startAndWait(): Promise

启动单幕渲染合成并等待完成

<br>

# MultiVideo

多幕视频

## 构造函数

### new MultiVideo(options: Object)

#### options 参数

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
            <td>outputPath</td>
            <td>string</td>
            <td>视频输出路径</td>
        </tr>
        <tr>
            <td>chunks</td>
            <td><a href="#chunkvideo">ChunkVideo</a>[]</td>
            <td>未渲染或已渲染的ChunkVideo列表，可以是ChunkVideo实例也可以是普通对象</td>
        </tr>
        <tr>
            <td>fps</td>
            <td>number</td>
            <td>视频帧率</td>
        </tr>
        <tr>
            <td>format</td>
            <td>string</td>
            <td>导出视频格式（mp4/webm）</td>
        </tr>
        <tr>
            <td>attachCoverPath</td>
            <td>string</td>
            <td>附加到视频首帧的封面文件路径</td>
        </tr>
        <tr>
            <td>coverCapture</td>
            <td>boolean</td>
            <td>是否捕获封面并输出</td>
        </tr>
        <tr>
            <td>coverCaptureTime</td>
            <td>number</td>
            <td>封面捕获时间点（毫秒）</td>
        </tr>
        <tr>
            <td>coverCaptureFormat</td>
            <td>string</td>
            <td>封面捕获格式（jpg/png/bmp）</td>
        </tr>
        <tr>
            <td>videoEncoder</td>
            <td>string</td>
            <td>视频编码器，详见 [视频编码器说明](./video-encoder.md)</td>
        </tr>
        <tr>
            <td>videoQuality</td>
            <td>number</td>
            <td>视频质量（0-100）</td>
        </tr>
        <tr>
            <td>videoBitrate</td>
            <td>string</td>
            <td>视频码率（设置码率将忽略videoQuality）</td>
        </tr>
        <tr>
            <td>pixelFormat</td>
            <td>string</td>
            <td>像素格式（yuv420p/yuv444p/rgb24）</td>
        </tr>
        <tr>
            <td>audioEncoder</td>
            <td>string</td>
            <td>音频编码器，建议默认aac</td>
        </tr>
        <tr>
            <td>audioBitrate</td>
            <td>string</td>
            <td>音频码率</td>
        </tr>
        <tr>
            <td>volume</td>
            <td>number</td>
            <td>视频音量（0-100）</td>
        </tr>
        <tr>
            <td>pagePrepareFn</td>
            <td>Function</td>
            <td>页面预处理函数，可以在渲染之前对Page对象操作</td>
        </tr>
        <tr>
            <td>showProgress</td>
            <td>boolean</td>
            <td>是否在命令行展示进度</td>
        </tr>
        <tr>
            <td>parallelWriteFrames</td>
            <td>number</td>
            <td>并行写入流的帧数</td>
        </tr>
    </tbody>
</table>

## 事件

### progress

合成进度事件，回调参数：(progress: number, processedFrameCount: number, totalFrameCount: number)

### completed

已完成合成事件，回调参数：(result)

### error

错误事件，回调参数：（err）

## 成员

### MultiVideo.registerFont(options: Object)

注册字体

#### options 参数

参考 [Font](#font) 字体参数。

### MultiVideo.registerFonts([options: Object, ...])

注册多个字体

#### options 参数

参考 [Font](#font) 字体参数。

### MultiVideo.addAudio(options: Object)

添加音频

#### options 参数

参考 [Audio](#audio) 音频参数。

### MultiVideo.addAudios([options: Object, ...])

添加多个音频

#### options 参数

参考 [Audio](#audio) 音频参数。

### MultiVideo.input(chunk: [ChunkVideo](#chunkvideo), [[transtion](#transition)])

输入分块视频，可以选择加入转场效果

#### chunk 参数

参考 [ChunkVideo](#chunkvideo) 。

#### transtion 参数

参考 [transtion](#transition) 。

### MultiVideo.start()

启动多幕视频渲染合成，如果输入的分块视频已经合成完毕则会跳过渲染进入合成阶段

### MultiVideo.startAndWait(): Promise

启动多幕视频渲染合成并等待完成

<br>

# ChunkVideo

分块视频

## 构造函数

### new ChunkVideo(options: Object)

#### options 参数

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
            <td>待渲染的页面URL，与content二选一</td>
        </tr>
        <tr>
            <td>content</td>
            <td>string</td>
            <td>待渲染的页面内容，与url二选一</td>
        </tr>
        <tr>
            <td>outputPath</td>
            <td>string</td>
            <td>视频输出路径</td>
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
            <td>视频帧率</td>
        </tr>
        <tr>
            <td>transition</td>
            <td>string | <a href="#transition">Transition</a></td>
            <td>进入下一视频分块的转场效果</td>
        </tr>
        <tr>
            <td>format</td>
            <td>string</td>
            <td>导出视频格式（mp4/webm）</td>
        </tr>
        <tr>
            <td>attachCoverPath</td>
            <td>string</td>
            <td>附加到视频首帧的封面文件路径</td>
        </tr>
        <tr>
            <td>coverCapture</td>
            <td>boolean</td>
            <td>是否捕获封面并输出</td>
        </tr>
        <tr>
            <td>coverCaptureTime</td>
            <td>number</td>
            <td>封面捕获时间点（毫秒）</td>
        </tr>
        <tr>
            <td>coverCaptureFormat</td>
            <td>string</td>
            <td>封面捕获格式（jpg/png/bmp）</td>
        </tr>
        <tr>
            <td>videoEncoder</td>
            <td>string</td>
            <td>视频编码器，详见 <a href="./video-encoder.md">视频编码器说明</a></td>
        </tr>
        <tr>
            <td>videoQuality</td>
            <td>number</td>
            <td>视频质量（0-100）</td>
        </tr>
        <tr>
            <td>videoBitrate</td>
            <td>string</td>
            <td>视频码率（设置码率将忽略videoQuality）</td>
        </tr>
        <tr>
            <td>pixelFormat</td>
            <td>string</td>
            <td>像素格式（yuv420p/yuv444p/rgb24）</td>
        </tr>
        <tr>
            <td>audioEncoder</td>
            <td>string</td>
            <td>音频编码器，建议默认aac</td>
        </tr>
        <tr>
            <td>audioBitrate</td>
            <td>string</td>
            <td>音频码率</td>
        </tr>
        <tr>
            <td>volume</td>
            <td>number</td>
            <td>视频音量（0-100）</td>
        </tr>
        <tr>
            <td>pageWaitForOptions</td>
            <td><a href="https://pptr.dev/api/puppeteer.waitforoptions">WaitForOptions</a></td>
            <td>页面等待选项</td>
        </tr>
        <tr>
            <td>pagePrepareFn</td>
            <td>Function</td>
            <td>页面预处理函数，可以在渲染之前对Page对象操作</td>
        </tr>
        <tr>
            <td>showProgress</td>
            <td>boolean</td>
            <td>是否在命令行展示进度</td>
        </tr>
        <tr>
            <td>autostartRender</td>
            <td>boolean</td>
            <td>是否自动启动渲染，如果为false请务必在页面中执行 captureCtx.start()</td>
        </tr>
        <tr>
            <td>consoleLog</td>
            <td>boolean</td>
            <td>是否开启控制台日志输出</td>
        </tr>
        <tr>
            <td>videoPreprocessLog</td>
            <td>boolean</td>
            <td>是否开启视频预处理日志输出</td>
        </tr>
        <tr>
            <td>parallelWriteFrames</td>
            <td>number</td>
            <td>并行写入流的帧数</td>
        </tr>
    </tbody>
</table>

## 事件

### progress

合成进度事件，回调参数：(progress: number, processedFrameCount: number, totalFrameCount: number)

### completed

已完成合成事件，回调参数：(result)

### error

错误事件，回调参数：（err）

## 成员

### ChunkVideo.registerFont(options: Object)

注册字体

#### options 参数

参考 [Font](#font) 字体参数。

### ChunkVideo.registerFonts([options: Object, ...])

注册多个字体

#### options 参数

参考 [Font](#font) 字体参数。

### ChunkVideo.addAudio(options: Object)

添加音频

#### options 参数

参考 [Audio](#audio) 音频参数。

### ChunkVideo.addAudios([options: Object, ...])

添加多个音频

#### options 参数

参考 [Audio](#audio) 音频参数。

### ChunkVideo.setTransition(options: Object)

设置转场效果

#### options 参数

参考 [Transition](#transition) 转场参数。

### ChunkVideo.start()

启动分块视频渲染合成，分块视频渲染后还需要输入到 [MultiVideo](#multivideo) 进行最终视频合成

### ChunkVideo.startAndWait(): Promise

启动分块视频渲染合成并等待完成

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