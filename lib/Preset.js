export const SUPPORT_FORMAT = [
    "mp4",
    "webm"
];

export const VIDEO_CODEC = {
    CPU: {
        H264: "libx264",
        H265: "libx265",
        VP8: "libvpx",
        VP9: "libvpx-vp9"
    },
    INTEL: {
        H264: "h264_qsv",
        H265: "hevc_qsv",
        VP8: "vp8_qsv",
        VP9: "vp9_qsv"
    },
    AMD: {
        H264: "h264_amf",
        H265: "h265_amf"
    },
    NVIDIA: {
        H264: "h264_nvenc",
        H265: "hevc_nvenc"
    },
    OMX: {
        H264: "h264_omx"
    },
    V4L2: {
        H264: "h264_v4l2m2m"
    },
    VAAPI: {
        H264: "h264_vaapi",
        H265: "hevc_vaapi",
        VP8: "vp8_vaapi",
        VP9: "vp9_vaapi"
    },
    VIDEOTOOLBOX: {
        H264: "h264_videotoolbox",
        H265: "hevc_videotoolbox"
    }
};

export const AUDIO_CODEC = {
    AAC: "aac",
    OPUS: "libopus"
}

export const BITSTREAM_FILTER = {
    H264: "h264_mp4toannexb",
    H265: "hevc_mp4toannexb",
    VP9: "vp9_superframe"
};

export const FORMAT_VIDEO_CODEC_MAP = {
    "mp4": [
        VIDEO_CODEC.CPU.H264,
        VIDEO_CODEC.CPU.H265,
        VIDEO_CODEC.INTEL.H264,
        VIDEO_CODEC.INTEL.H265,
        VIDEO_CODEC.AMD.H264,
        VIDEO_CODEC.AMD.H265,
        VIDEO_CODEC.NVIDIA.H264,
        VIDEO_CODEC.NVIDIA.H265,
        VIDEO_CODEC.OMX.H264,
        VIDEO_CODEC.V4L2.H264,
        VIDEO_CODEC.VAAPI.H264,
        VIDEO_CODEC.VAAPI.H265,
        VIDEO_CODEC.VIDEOTOOLBOX.H264,
        VIDEO_CODEC.VIDEOTOOLBOX.H265
    ],
    "webm": [
        VIDEO_CODEC.CPU.VP8,
        VIDEO_CODEC.CPU.VP9,
        VIDEO_CODEC.INTEL.VP9,
        VIDEO_CODEC.VAAPI.VP8,
        VIDEO_CODEC.VAAPI.VP9
    ],
    "ts": [
        VIDEO_CODEC.CPU.H264,
        VIDEO_CODEC.CPU.H265,
        VIDEO_CODEC.INTEL.H264,
        VIDEO_CODEC.INTEL.H265,
        VIDEO_CODEC.AMD.H264,
        VIDEO_CODEC.AMD.H265,
        VIDEO_CODEC.NVIDIA.H264,
        VIDEO_CODEC.NVIDIA.H265,
        VIDEO_CODEC.OMX.H264,
        VIDEO_CODEC.V4L2.H264,
        VIDEO_CODEC.VAAPI.H264,
        VIDEO_CODEC.VAAPI.H265,
        VIDEO_CODEC.VIDEOTOOLBOX.H264,
        VIDEO_CODEC.VIDEOTOOLBOX.H265
    ]
};

export const FORMAT_AUDIO_CODEC_MAP = {
    "mp4": [
        AUDIO_CODEC.AAC,
        AUDIO_CODEC.OPUS
    ],
    "webm": [
        AUDIO_CODEC.AAC,
        AUDIO_CODEC.OPUS
    ]
};