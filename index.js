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
        // const previewer = new Previewer();
        // await previewer.launch();
        const synthesizer = new FrameSynthesizer({
            outputPath: "./test.mp4",
            width: 1920,
            height: 1080,
            fps: 60,
            videoCodec: FrameSynthesizer.VCODEC.NVIDIA.H264
        });
        synthesizer.start();
        page.on("consoleLog", message => console.log(message));
        page.on("consoleError", err => console.error(err));
        page.on("frame", buffer => synthesizer.input(buffer));
        page.on("error", err => console.error("page error:", err));
        page.on("crashed", err => console.error("page crashed:", err));
        await page.goto("https://threejs.org/examples/webgl_lights_spotlight.html");
        await page.setViewport({ width: 1920, height: 1080 });
        await page.startScreencast({ fps: 60, duration: 20000 });
        console.time(`render`);
        await new Promise(resolve => page.once("screencastCompleted", resolve));
        console.timeEnd(`render`);
        await page.stopScreencast();
        await page.release();
        synthesizer.endInput();
        console.log("END");
    })()
    .catch(err => console.error(err));
}