import os from 'os';

export default {

    isLinux() {
        return os.platform() !== "win32";
    }

}