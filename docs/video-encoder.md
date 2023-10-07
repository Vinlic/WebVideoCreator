# 视频编码器

从模块引入视频编码器常量即可使用。

```javascript
import { VIDEO_ENCODER } from "web-video-creator";

console.log(VIDEO_ENCODER.CPU.H264);  // 输出 libx264
console.log(VIDEO_ENCODER.NVIDIA.H264);  // 输出 h264_nvenc
```

## CPU 软编码器

软编码器通常较慢，建议根据您的设备支持情况选用其它硬编码器。

<table width="100%">
    <thead>
        <tr>
            <th>常量名</th>
            <th>编码器名称</th>
            <th>编码器说明</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>CPU.H264</td>
            <td>libx264</td>
            <td>使用CPU进行H264软编码，适配容器：mp4</td>
        </tr>
        <tr>
            <td>CPU.H265</td>
            <td>libx265</td>
            <td>使用CPU进行H265软编码，适配容器：mp4</td>
        </tr>
        <tr>
            <td>CPU.VP8</td>
            <td>libvpx</td>
            <td>使用CPU进行VP8软编码，适配容器：webm</td>
        </tr>
        <tr>
            <td>CPU.VP9</td>
            <td>libvpx-vp9</td>
            <td>使用CPU进行VP9软编码，适配容器：webm</td>
        </tr>
    </tbody>
</table>

## Intel QSV 编码器

<table width="100%">
    <thead>
        <tr>
            <th>常量名</th>
            <th>编码器名称</th>
            <th>编码器说明</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>INTEL.H264</td>
            <td>h264_qsv</td>
            <td>使用Intel核显或独显的QSV加速H264编码，适配容器：mp4</td>
        </tr>
        <tr>
            <td>INTEL.H265</td>
            <td>hevc_qsv</td>
            <td>使用Intel核显或独显的QSV加速H265编码，适配容器：mp4</td>
        </tr>
        <tr>
            <td>INTEL.VP8</td>
            <td>vp8_qsv</td>
            <td>使用Intel核显或独显的QSV加速VP8编码，适配容器：webm</td>
        </tr>
        <tr>
            <td>INTEL.VP9</td>
            <td>vp9_qsv</td>
            <td>使用Intel核显或独显的QSV加速VP9编码，适配容器：webm</td>
        </tr>
    </tbody>
</table>

## AMD AMF 编码器

<table width="100%">
    <thead>
        <tr>
            <th>常量名</th>
            <th>编码器名称</th>
            <th>编码器说明</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>AMD.H264</td>
            <td>h264_amf</td>
            <td>使用AMD核显或独显的AMF加速H264编码，适配容器：mp4</td>
        </tr>
        <tr>
            <td>AMD.H265</td>
            <td>h265_amf</td>
            <td>使用AMD核显或独显的AMF加速H265编码，适配容器：mp4</td>
        </tr>
    </tbody>
</table>

## Nvidia NvENC编码器

消费级显卡会遇到最高并行两路NVENC编码的限制，需通过[补丁](https://github.com/keylase/nvidia-patch)解决。

<table width="100%">
    <thead>
        <tr>
            <th>常量名</th>
            <th>编码器名称</th>
            <th>编码器说明</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>NVIDIA.H264</td>
            <td>h264_nvenc</td>
            <td>使用Nvidia显卡NVENC加速H264编码，适配容器：mp4</td>
        </tr>
        <tr>
            <td>NVIDIA.H265</td>
            <td>hevc_nvenc</td>
            <td>使用Nvidia显卡NVENC加速H265编码，适配容器：mp4</td>
        </tr>
    </tbody>
</table>

## OpenOMX 编码器

<table width="100%">
    <thead>
        <tr>
            <th>常量名</th>
            <th>编码器名称</th>
            <th>编码器说明</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>OMX.H264</td>
            <td>h264_omx</td>
            <td>使用OpenOMX加速H264编码，适用于嵌入式平台，适配容器：mp4</td>
        </tr>
    </tbody>
</table>

## V4L2 编码器

<table width="100%">
    <thead>
        <tr>
            <th>常量名</th>
            <th>编码器名称</th>
            <th>编码器说明</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>V4L2.H264</td>
            <td>h264_v4l2m2m</td>
            <td>使用V4L2加速H264编码，适配容器：mp4</td>
        </tr>
    </tbody>
</table>

## VAAPI 编码器

<table width="100%">
    <thead>
        <tr>
            <th>常量名</th>
            <th>编码器名称</th>
            <th>编码器说明</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>VAAPI.H264</td>
            <td>h264_vaapi</td>
            <td>使用VAAPI加速H264编码，适配容器：mp4</td>
        </tr>
        <tr>
            <td>VAAPI.H265</td>
            <td>hevc_vaapi</td>
            <td>使用VAAPI加速H265编码，适配容器：mp4</td>
        </tr>
        <tr>
            <td>VAAPI.VP8</td>
            <td>vp8_vaapi</td>
            <td>使用VAAPI加速VP8编码，适配容器：webm</td>
        </tr>
        <tr>
            <td>VAAPI.VP9</td>
            <td>vp9_vaapi</td>
            <td>使用VAAPI加速VP9编码，适配容器：webm</td>
        </tr>
    </tbody>
</table>

## VIDEOTOOLBOX 编码器

<table width="100%">
    <thead>
        <tr>
            <th>常量名</th>
            <th>编码器名称</th>
            <th>编码器说明</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>VIDEOTOOLBOX.H264</td>
            <td>h264_videotoolbox</td>
            <td>使用VIDEOTOOLBOX加速H264编码，适用于MAC，适配容器：mp4</td>
        </tr>
        <tr>
            <td>VIDEOTOOLBOX.H265</td>
            <td>hevc_videotoolbox</td>
            <td>使用VIDEOTOOLBOX加速H265编码，适用于MAC，适配容器：mp4</td>
        </tr>
    </tbody>
</table>