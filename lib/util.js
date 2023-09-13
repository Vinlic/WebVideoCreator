import os from 'os';
import { fileURLToPath } from 'url';
import path from 'path';

const ROOT_PATH = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export default {
    
    rootPathJoin(relativePath) {
        return path.join(ROOT_PATH, relativePath);
    },

    isLinux() {
        return os.platform() !== "win32";
    }

}