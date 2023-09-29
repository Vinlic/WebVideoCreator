import os from "os";
import assert from "assert";
import fs from "fs-extra";
import { BrowserPlatform, Browser, install, resolveBuildId, computeExecutablePath } from "@puppeteer/browsers";

import cliProgress from "cli-progress";
import logger from "./logger.js";
import _ from "lodash";
import util from "./util.js";

// 默认浏览器安装路径
const browserInstallPath = util.rootPathJoin(".bin");
// 默认浏览器名称
// 目前只限于chrome，如使用chromium可能会缺失H264解码功能
const browserName = Browser.CHROME;
// 默认浏览器版本号，不能低于119.0.6018.0，否则无法使用VideoDecoder解码H264
// 请参考：https://github.com/GoogleChromeLabs/chrome-for-testing/issues/18
const browserVersion = "119.0.6029.0";
// 下载进度条
const downloadProgressBar = new cliProgress.SingleBar({ hideCursor: true }, cliProgress.Presets.shades_classic);

/**
 * 安装浏览器
 * 
 * @param {string} installPath - 安装路径
 * @param {Object} [options] - 安装选项
 * @param {string} [options.name] - 安装浏览器名称
 * @param {string} [options.version] - 安装浏览器版本
 * @returns {Object} - 包含执行路径的对象
 */
export default async function installBrowser(installPath = browserInstallPath, options = {}) {

    assert(_.isString(installPath), "install path must be string");
    assert(_.isObject(options), "options must be Object");
    const { name = browserName, version = browserVersion } = options;
    assert(_.isString(name), "browser name must be string");
    assert(_.isString(version), "version must be string");

    let platform = os.platform();
    const arch = os.arch();

    if (platform == "win32") {
        if (arch == "x64")
            platform = BrowserPlatform.WIN64;
        else
            platform = BrowserPlatform.WIN32;
    }
    else if (platform == "darwin") {
        logger.warn("The headless browser of the Mac system may not be able to use the headless experimental API properly.");
        if (arch == "arm64")
            platform = BrowserPlatform.MAC_ARM;
        else
            platform = BrowserPlatform.MAC;
    }
    else
        platform = BrowserPlatform.LINUX;

    const buildId = await resolveBuildId(name, platform, version);
    const downloadOptions = {
        cacheDir: installPath,
        browser: name,
        platform,
        buildId
    };

    const executablePath = computeExecutablePath(downloadOptions);
    if (!await fs.pathExists(executablePath)) {
        logger.info(`\nInstalling ${name} into ${installPath}`);
        let downloadStart = false;
        await install({
            ...downloadOptions,
            downloadProgressCallback: (downloadedBytes, totalBytes) => {
                if (!downloadStart) {
                    downloadProgressBar.start(Infinity, 0);
                    downloadStart = true;
                }
                downloadProgressBar.setTotal(totalBytes);
                downloadProgressBar.update(downloadedBytes);
            }
        });
        logger.info("\nInstallation completed");
    }

    return {
        executablePath
    };

}