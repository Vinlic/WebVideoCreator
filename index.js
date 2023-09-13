import Pool from "./lib/Pool.js";
import Synthesizer from "./lib/Synthesizer.js";

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
            height: 1080
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
        const synthesizer = new Synthesizer(`${i}`);
        page.on("consoleLog", message => console.log(message));
        page.on("consoleError", err => console.error(err));
        page.on("frame", data => synthesizer.inputFrame(data));
        page.on("error", err => console.error("page error:", err));
        page.on("crashed", err => console.error("page crashed:", err));
        await page.goto("https://threejs.org/examples/webgl_lights_spotlight.html");
        await page.setViewport({ width: 1920, height: 1080 });
        await page.startScreencast({ fps: 60, duration: 20000 });
        console.time(`render${i}`);
        await new Promise(resolve => page.once("screencastCompleted", resolve));
        console.timeEnd(`render${i}`);
        await page.stopScreencast();
        await page.release();
    })()
    .catch(err => console.error(err));
}