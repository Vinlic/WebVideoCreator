export const SUPPORT_FORMAT = [
    "mp4",
    "webm"
];

export const VCODEC = {
    CPU: {
        H264: "libx264",
        H265: "libx265",
        VP8: "libvpx",
        VP9: "libvpx-vp9"
    },
    INTEL: {
        H264: "h264_qsv",
        H265: "hevc_qsv",
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

export const ACODEC = {
    AAC: "aac",
    OPUS: "libopus"
}

export const FORMAT_VCODEC_MAP = {
    "mp4": [
        VCODEC.CPU.H264,
        VCODEC.CPU.H265,
        VCODEC.INTEL.H264,
        VCODEC.INTEL.H265,
        VCODEC.AMD.H264,
        VCODEC.AMD.H265,
        VCODEC.NVIDIA.H264,
        VCODEC.NVIDIA.H265,
        VCODEC.OMX.H264,
        VCODEC.V4L2.H264,
        VCODEC.VAAPI.H264,
        VCODEC.VAAPI.H265,
        VCODEC.VIDEOTOOLBOX.H264,
        VCODEC.VIDEOTOOLBOX.H265
    ],
    "webm": [
        VCODEC.CPU.VP8,
        VCODEC.CPU.VP9,
        VCODEC.INTEL.VP9,
        VCODEC.VAAPI.VP8,
        VCODEC.VAAPI.VP9
    ]
};

export const FORMAT_ACODEC_MAP = {
    "mp4": [
        ACODEC.AAC,
        ACODEC.OPUS
    ],
    "webm": [
        ACODEC.AAC,
        ACODEC.OPUS
    ]
};