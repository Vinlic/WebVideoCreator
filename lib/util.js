import os from "os";
import http from "http";
import { fileURLToPath } from "url";
import path from "path";

const ROOT_PATH = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export default {

    rootPathJoin(relativePath) {
        return path.join(ROOT_PATH, relativePath);
    },

    /**
     * 检查远端资源是否可访问
     * 
     * @param {string} url - 资源URL
     * @param {string[]} [mimesLimit] - MIME类型限制列表
     */
    async checkRemoteResource(url, mimesLimit) {
        await new Promise((resolve, reject) => {
            const { hostname, port, pathname } = new URL(url);
            const req = http.request({
                method: "head",
                hostname,
                port,
                path: pathname
            }, res => {
                if (res.statusCode >= 400)
                    reject(new Error(`Resource ${url} request error: [${res.statusCode || 0}] ${res.statusMessage || "Unknown"}`));
                const mime = res.headers["content-type"] || "unknown";
                const size = res.headers["content-length"];
                if (_.isArray(mimesLimit) && !mimes.includes(mime))
                    reject(new Error(`Resource ${url} content type ${mime} is not supported`));
                resolve({
                    mime,
                    size: size ? Number(size) : null
                });
            });
            req.on("error", reject);
            req.end();
        });
    },

    isLinux() {
        return os.platform() !== "win32";
    }

}