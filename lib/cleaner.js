import fs from "fs-extra";

import util from "./util.js";

export default {

    async cleanBrowserCache() {
        await fs.emptyDir(util.rootPathJoin("tmp/browser"));
    },

    async cleanPreprocessorCache() {
        await fs.emptyDir(util.rootPathJoin("tmp/preprocessor"));
    },

    async cleanSynthesizerCache() {
        await fs.emptyDir(util.rootPathJoin("tmp/synthesizer"));
    },
    
    async cleanFontCache() {
        await fs.emptyDir(util.rootPathJoin("tmp/font"));
    }

};