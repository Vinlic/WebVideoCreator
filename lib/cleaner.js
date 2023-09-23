import fs from "fs-extra";

import util from "./util.js";

export default {

    /**
     * 清除无头浏览器缓存
     */
    async cleanBrowserCache() {
        await fs.emptyDir(util.rootPathJoin("tmp/browser"));
    },

    /**
     * 清理预处理器缓存
     */
    async cleanPreprocessorCache() {
        await fs.emptyDir(util.rootPathJoin("tmp/preprocessor"));
    },

    /**
     * 清理合成器缓存
     */
    async cleanSynthesizerCache() {
        await fs.emptyDir(util.rootPathJoin("tmp/synthesizer"));
    },
    
    /**
     * 清理本地字体缓存
     */
    async cleanLocalFontCache() {
        await fs.emptyDir(util.rootPathJoin("tmp/local_font"));
    }

};