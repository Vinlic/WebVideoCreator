/** 支持的格式枚举 */
export const SUPPORT_FORMAT = [
    "mp4",
    "webm"
];

/** 视频编码器 */
export const VIDEO_ENCODER = {
    CPU: {
        /**
         * 使用CPU进行H264软编码
         * 适配容器：mp4
         * 建议更改使用其它硬编码方案加速合成
         */
        H264: "libx264",
        /**
         * 使用CPU进行H265软编码
         * 适配容器：mp4
         * 建议更改使用其它硬编码方案加速合成
         */
        H265: "libx265",
        /**
         * 使用CPU进行VP8软编码
         * 适配容器：webm
         * 建议更改使用其它硬编码方案加速合成
         */
        VP8: "libvpx",
        /**
         * 使用CPU进行VP9软编码
         * 适配容器：webm
         * 建议更改使用其它硬编码方案加速合成
         */
        VP9: "libvpx-vp9"
    },
    INTEL: {
        /** 
         * 使用Intel核显或独显的QSV加速H264编码
         * 适配容器：mp4
         */
        H264: "h264_qsv",
        /**
         * 使用Intel核显或独显的QSV加速H265编码
         * 适配容器：mp4
         */
        H265: "hevc_qsv",
        /** 
         * 使用Intel核显或独显的QSV加速VP8编码
         * 适配容器：webm
         */
        VP8: "vp8_qsv",
        /**
         * 使用Intel核显或独显的QSV加速VP9编码
         * 适配容器：webm
         */
        VP9: "vp9_qsv"
    },
    AMD: {
        /**
         * 使用AMD核显或独显的AMF加速H264编码
         * 适配容器：mp4
         */
        H264: "h264_amf",
        /**
         * 使用AMD核显或独显的AMF加速H265编码
         * 适配容器：mp4
         */
        H265: "h265_amf"
    },
    NVIDIA: {
        /** 
         * 使用Nvidia显卡NVENC加速H264编码
         * 适配容器：mp4
         * 通过 https://developer.nvidia.com/video-encode-and-decode-gpu-support-matrix-new 查看支持情况
         */
        H264: "h264_nvenc",
        /** 
         * 使用Nvidia显卡NVENC加速H265编码
         * 适配容器：mp4
         * 通过 https://developer.nvidia.com/video-encode-and-decode-gpu-support-matrix-new 查看支持情况
         */
        H265: "hevc_nvenc"
    },
    OMX: {
        /**
         * 使用OpenOMX加速H264编码，可能适用于嵌入式平台
         * 适配容器：mp4
         */
        H264: "h264_omx"
    },
    V4L2: {
        /**
         * 使用V4L2加速H264编码
         * 适配容器：mp4
         */
        H264: "h264_v4l2m2m"
    },
    VAAPI: {
        /**
         * 使用VAAPI加速H264编码
         * 适配容器：mp4
         */
        H264: "h264_vaapi",
        /**
         * 使用VAAPI加速H265编码
         * 适配容器：mp4
         */
        H265: "hevc_vaapi",
        /**
         * 使用VAAPI加速VP8编码
         * 适配容器：webm
         */
        VP8: "vp8_vaapi",
        /**
         * 使用VAAPI加速VP9编码
         * 适配容器：webm
         */
        VP9: "vp9_vaapi"
    },
    VIDEOTOOLBOX: {
        /**
         * 使用VIDEOTOOLBOX加速H264编码，适用于MAC
         * 适配容器：mp4
         */
        H264: "h264_videotoolbox",
        /**
         * 使用VIDEOTOOLBOX加速H265编码，适用于MAC
         * 适配容器：mp4
         */
        H265: "hevc_videotoolbox"
    }
};

/** 视频编码器映射 */
export const VIDEO_ENCODER_MAP = Object.values(VIDEO_ENCODER).reduce((map, o) => {
    Object.entries(o).forEach(([type, codec]) => {
        !map[type] && (map[type] = []);
        map[type].push(codec)
    });
    return map;
}, {});

export const AUDIO_ENCODER = {
    /**
     * AAC音频编码
     * 建议使用此编码
     */
    AAC: "aac",
    /**
     * OPUS音频编码
     */
    OPUS: "libopus"
}

/** 音频编码器映射 */
export const AUDIO_ENCODER_MAP = Object.values(AUDIO_ENCODER).reduce((map, o) => {
    Object.entries(o).forEach(([type, codec]) => {
        !map[type] && (map[type] = []);
        map[type].push(codec)
    });
    return map;
}, {});

/** 比特流过滤器 */
export const BITSTREAM_FILTER = {
    H264: "h264_mp4toannexb",
    H265: "hevc_mp4toannexb",
    VP9: "vp9_superframe"
};

/** 视频格式映射到支持的视频编码器 */
export const FORMAT_VIDEO_ENCODER_MAP = {
    "mp4": [
        VIDEO_ENCODER.CPU.H264,
        VIDEO_ENCODER.CPU.H265,
        VIDEO_ENCODER.INTEL.H264,
        VIDEO_ENCODER.INTEL.H265,
        VIDEO_ENCODER.AMD.H264,
        VIDEO_ENCODER.AMD.H265,
        VIDEO_ENCODER.NVIDIA.H264,
        VIDEO_ENCODER.NVIDIA.H265,
        VIDEO_ENCODER.OMX.H264,
        VIDEO_ENCODER.V4L2.H264,
        VIDEO_ENCODER.VAAPI.H264,
        VIDEO_ENCODER.VAAPI.H265,
        VIDEO_ENCODER.VIDEOTOOLBOX.H264,
        VIDEO_ENCODER.VIDEOTOOLBOX.H265
    ],
    "webm": [
        VIDEO_ENCODER.CPU.VP8,
        VIDEO_ENCODER.CPU.VP9,
        VIDEO_ENCODER.INTEL.VP9,
        VIDEO_ENCODER.VAAPI.VP8,
        VIDEO_ENCODER.VAAPI.VP9
    ],
    "ts": [
        VIDEO_ENCODER.CPU.H264,
        VIDEO_ENCODER.CPU.H265,
        VIDEO_ENCODER.INTEL.H264,
        VIDEO_ENCODER.INTEL.H265,
        VIDEO_ENCODER.AMD.H264,
        VIDEO_ENCODER.AMD.H265,
        VIDEO_ENCODER.NVIDIA.H264,
        VIDEO_ENCODER.NVIDIA.H265,
        VIDEO_ENCODER.OMX.H264,
        VIDEO_ENCODER.V4L2.H264,
        VIDEO_ENCODER.VAAPI.H264,
        VIDEO_ENCODER.VAAPI.H265,
        VIDEO_ENCODER.VIDEOTOOLBOX.H264,
        VIDEO_ENCODER.VIDEOTOOLBOX.H265
    ]
};

/** 视频格式映射到支持的音频编码器 */
export const FORMAT_AUDIO_ENCODER_MAP = {
    "mp4": [
        AUDIO_ENCODER.AAC,
        AUDIO_ENCODER.OPUS
    ],
    "webm": [
        AUDIO_ENCODER.AAC,
        AUDIO_ENCODER.OPUS
    ]
};

/**
 * Xfade转场滤镜
 * 请参考：http://trac.ffmpeg.org/wiki/Xfade
 */
export const TRANSITION = {
    /** 淡入淡出 */
    FADE: "fade",
    /** 从右向左擦除 */
    WIPE_LEFT: "wipeleft",
    /** 从左向右擦除 */
    WIPE_RIGHT: "wiperight",
    /** 从下往上擦除 */
    WIPE_UP: "wipeup",
    /** 从上往下擦除 */
    WIPE_DOWN: "wipedown",
    /** 从右向左滑动 */
    SLIDE_LEFT: "slideleft",
    /** 从左向右滑动 */
    SLIDE_RIGHT: "slideright",
    /** 从下往上滑动 */
    SLIDE_UP: "slideup",
    /** 从上往下滑动 */
    SLIDE_DOWN: "slidedown",
    /** 圆形裁剪过渡 */
    CIRCLE_CROP: "circlecrop",
    /** 矩形裁剪过渡 */
    RECT_CROP: "rectcrop",
    /** 色块过渡 */
    DISTANCE: "distance",
    /** 黑色渐变淡入淡出 */
    FADE_BLACK: "fadeblack",
    /** 白色渐变淡入淡出 */
    FADE_WHITE: "fadewhite",
    /** 雷达扫描 */
    RADIAL: "radial",
    /** 从右向左平滑过渡 */
    SMOOTH_LEFT: "smoothleft",
    /** 从左向右平滑过渡 */
    SMOOTH_RIGHT: "smoothright",
    /** 从下向上平滑过渡 */
    SMOOTH_UP: "smoothup",
    /** 从上向下平滑过渡 */
    SMOOTH_DOWN: "smoothdown",
    /** 圆形开放过渡 */
    CIRCLE_OPEN: "circleopen",
    /** 圆形闭合过渡 */
    CIRCLE_CLOSE: "circleclose",
    /** 垂直方向开放过渡 */
    VERT_OPEN: "vertopen",
    /** 垂直方向闭合过渡 */
    VERT_CLOSE: "vertclose",
    /** 水平方向开放过渡 */
    HORZ_OPEN: "horzopen",
    /** 水平方向闭合过渡 */
    HORZ_CLOSE: "horzclose",
    /** 溶解过渡 */
    DISSOLVE: "dissolve",
    /** 像素化过渡 */
    PIXELIZE: "pixelize",
    /** 右下对角线过渡 */
    DIAGL: "diagtl",
    /** 左下对角线过渡 */
    DIAGTR: "diagtr",
    /** 右上对角线过渡 */
    DIAGBL: "diagbl",
    /** 左上对角线过渡 */
    DIAGBR: "diagbr",
    /** 水平从右向左百叶窗过渡 */
    SLICE_LEFT: "hlslice",
    /** 水平从左向右百叶窗过渡 */
    SLICE_RIGHT: "hrslice",
    /** 垂直从右向左百叶窗过渡 */
    SLICE_UP: "vuslice",
    /** 垂直从右向左百叶窗过渡 */
    SLICE_DOWN: "vdslice",
    /** 高速模糊效果 */
    HBLUR: "hblur",
    /** 灰度渐变 */
    FADE_GRAYS: "fadegrays",
    /** 从右下向左上擦除 */
    WIPE_TL: "wipetl",
    /** 从左下向右上角擦除 */
    WIPE_TR: "wipetr",
    /** 从右上向左下擦除 */
    WIPE_BL: "wipebl",
    /** 从左上向右下擦除 */
    WIPE_BR: "wipebr",
    /** 水平挤压 */
    SQUEEZEH: "squeezeh",
    /** 垂直挤压 */
    SQUEEZEV: "squeezev",
    /** 放大过渡 */
    ZOOM_IN: "zoomin",
    /** 从右向左扫过 */
    WIND_LEFT: "hlwind",
    /** 从左向右扫过 */
    WIND_RIGHT: "hrwind",
    /** 从下向上扫过 */
    WIND_UP: "vuwind",
    /** 从上向下扫过 */
    WIND_DOWN: "vdwind",
    /** 从右向左覆盖 */
    COVER_LEFT: "coverleft",
    /** 从左向右覆盖 */
    COVER_RIGHT: "coverright",
    /** 从下向上覆盖 */
    COVER_UP: "coverup",
    /** 从上向下覆盖 */
    COVER_DOWN: "coverdown",
    /** 从右向左揭开 */
    REVEAL_LEFT: "revealleft",
    /** 从左向右揭开 */
    REVEAL_RIGHT: "revealright",
    /** 从下向上揭开 */
    REVEAL_UP: "revealup",
    /** 从上向下揭开 */
    REVEAL_DOWN: "revealdown"
};