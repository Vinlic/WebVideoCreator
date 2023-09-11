import Pool from "./lib/Pool.js";
import Synthesizer from "./lib/Synthesizer.js";
import fs from "fs-extra";

const pool = new Pool({
    numBrowserMin: 1,
    numBrowserMax: 1,
    browserOptions: {
        headless: true,
        numPageMin: 1,
        numPageMax: 1,
        useGPU: true,
        debug: false,
        pageOptions: {
            width: 1920,
            height: 1080
        }
    }
});

(async () => {
    // https://animejs.com/
    // https://dataveyes.com/en
    // https://fifty-five.com
    
    await fs.remove("./test");
    await fs.ensureDir("test");
    const synthesizer = new Synthesizer();
    await pool.warmup();
    let page = await pool.acquirePage();
    page.onLog(message => console.log(message));
    page.onFrame(data => synthesizer.inputFrame(data));
    page.onPad(duration => synthesizer.padDuration(duration));
    await page.goto("https://animejs.com/");
    await page.setViewport({ width: 1920, height: 1080 });
    await page.startScreencast({ fps: 60, duration: 20000 });
    console.time("render");
    await new Promise(resolve => page.onComplete(resolve));
    console.timeEnd("render");
    // await new Promise(resolve => setTimeout(resolve, 15000));
    await page.stopScreencast();
    await page.release();
    // page = await pool.acquirePage();
    // console.log(page);
    // page.onFrame();
})()
.catch(err => console.error(err));