# WebVideoCreator

### WebVideoCreator.config([options])

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
            <td>browserExecutablePath</td>
            <td>string</td>
            <td>浏览器可执行文件路径，设置后将禁用内部的浏览器，建议您默认使用内部的浏览器以确保功能完整性</td>
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

### WebVideoCreator.createSingleVideo(options): [SingleVideo](#singlevideo)

创建单幕视频实例

<br>

### WebVideoCreator.createMultiVideo(options): [MultiVideo](#multivideo)

创建多幕视频实例

<br>

### WebVideoCreator.createChunkVideo(options): [ChunkVideo](#chunkvideo)

创建分块视频实例

<br>

# SingleVideo

单幕视频

## 事件

### progress

合成进度事件，回调参数：(progress, processedFrameCount, totalFrameCount)

### completed

已完成合成事件，回调参数：(result)

### error

错误事件，回调参数：（err）

## 成员

### SingleVideo.registerFont(options)

注册字体

### SingleVideo.registerFonts([options, ...])

注册多个字体

### SingleVideo.addAudio(options)

添加音频

### SingleVideo.addAudios([options, ...])

添加多个音频

### SingleVideo.start()

启动单幕渲染合成

### SingleVideo.startAndWait(): Promise

启动单幕渲染合成并等待完成

<br>

# MultiVideo

多幕视频

## 事件

### progress

合成进度事件，回调参数：(progress, processedFrameCount, totalFrameCount)

### completed

已完成合成事件，回调参数：(result)

### error

错误事件，回调参数：（err）

## 成员

### MultiVideo.registerFont(options)

注册字体

### MultiVideo.registerFonts([options, ...])

注册多个字体

### MultiVideo.addAudio(options)

添加音频

### MultiVideo.addAudios([options, ...])

添加多个音频

### MultiVideo.input(chunk, [[transtion](#transition)])

输入分块视频，可以选择加入转场效果

### MultiVideo.start()

启动多幕视频渲染合成，如果输入的分块视频已经合成完毕则会跳过渲染进入合成阶段

### MultiVideo.startAndWait(): Promise

启动多幕视频渲染合成并等待完成

<br>

# ChunkVideo

## 事件

### progress

合成进度事件，回调参数：(progress, processedFrameCount, totalFrameCount)

### completed

已完成合成事件，回调参数：(result)

### error

错误事件，回调参数：（err）

## 成员

### ChunkVideo.registerFont(options)

注册字体

### ChunkVideo.registerFonts([options, ...])

注册多个字体

### ChunkVideo.addAudio(options)

添加音频

### ChunkVideo.addAudios([options, ...])

添加多个音频

### ChunkVideo.start()

启动分块视频渲染合成，分块视频渲染后还需要输入到 [MultiVideo](#multivideo) 进行最终视频合成

### ChunkVideo.startAndWait(): Promise

启动分块视频渲染合成并等待完成

# Transition

转场参数，目前使用的是 [Xfade](https://trac.ffmpeg.org/wiki/Xfade) 转场滤镜。

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

