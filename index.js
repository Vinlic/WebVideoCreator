import Pool from "./lib/Pool.js";
import FrameSynthesizer from "./lib/FrameSynthesizer.js";
import Previewer from "./lib/Previewer.js";

const pool = new Pool({
    numBrowserMin: 1,
    numBrowserMax: 5,
    browserOptions: {
        headless: true,
        numPageMin: 1,
        numPageMax: 5,
        useGPU: true,
        debug: false,
        pageOptions: {
            width: 1920,
            height: 1080,
        }
    }
});

// https://animejs.com/
// https://dataveyes.com/en
// https://fifty-five.com

await pool.warmup();

for(let i = 0;i < 1;i++) {
    (async () => {
        const page = await pool.acquirePage();

        const width = 1920;
        const height = 1080;
        const fps = 30;
        const duration = 20000;

        // const previewer = new Previewer();
        // await previewer.launch();
        const synthesizer = new FrameSynthesizer({
            outputPath: "./test.mp4",
            width,
            height,
            fps,
            duration,
            videoCodec: FrameSynthesizer.VCODEC.NVIDIA.H264
        });
        synthesizer.on("progress", progress => {
            console.log(progress);
        });
        synthesizer.on("error", err => console.error(err));
        // synthesizer.addAudio({
        //     path: "tmp3fpc1yx7.wav",
        //     // seekStart: 500,
        //     // seekEnd: 1000,
        //     loop: true
        //     // endTime: 10000
        // });
        synthesizer.start();
        const completedPromise = new Promise(resolve => synthesizer.once("completed", resolve));
        page.on("consoleLog", message => console.log(message));
        page.on("consoleError", err => console.error(err));
        page.on("frame", buffer => synthesizer.input(buffer));
        page.on("error", err => console.error("page error:", err));
        page.on("crashed", err => console.error("page crashed:", err));
        await page.goto("https://dataveyes.com/en");
        await page.setViewport({ width, height });
        await page.startScreencast({ fps, duration });
        console.log((await page.getCaptureContextConfig()))
        console.time(`render`);
        await new Promise(resolve => page.once("screencastCompleted", resolve));
        console.timeEnd(`render`);
        await page.stopScreencast();
        await page.release();
        synthesizer.endInput();
        await completedPromise;
        console.log("END");
    })()
    .catch(err => console.error(err));
}