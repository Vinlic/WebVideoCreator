import Pool from "./lib/Pool.js";
import Synthesizer from "./lib/Synthesizer.js";
import fs from "fs-extra";

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
        page.onLog(message => console.log(message));
        const synthesizer = new Synthesizer(`${i}`);
        page.onFrame((data, timestamp) => synthesizer.inputFrame(data, timestamp));
        page.onPad(duration => synthesizer.padDuration(duration));
        await page.goto("https://threejs.org/examples/webgl_lights_spotlight.html");
        await page.setViewport({ width: 1920, height: 1080 });
        await page.startScreencast({ fps: 60, duration: 20000 });
        console.time(`render${i}`);
        await new Promise(resolve => page.onComplete(resolve));
        console.timeEnd(`render${i}`);
        // await new Promise(resolve => setTimeout(resolve, 15000));
        await page.stopScreencast();
        await page.release();
        // page = await pool.acquirePage();
        // console.log(page);
        // page.onFrame();
    })()
    .catch(err => console.error(err));
}