import Pool from "./lib/Pool.js";
import Synthesizer from "./lib/Synthesizer.js";

const pool = new Pool({
    numBrowserMin: 1,
    numBrowserMax: 1,
    browserOptions: {
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
    const synthesizer = new Synthesizer();
    await pool.warmup();
    let page = await pool.acquirePage();
    page.onFrame(data => synthesizer.inputFrame(data));
    page.onPad(duration => synthesizer.padDuration(duration));
    await page.goto("https://threejs.org/examples/webgl_animation_keyframes.html");
    await page.setViewport({ width: 1920, height: 1080 });
    await page.startScreencast();
    await new Promise(resolve => setTimeout(resolve, 15000));
    await page.stopScreencast();
    await page.release();
    page = await pool.acquirePage();
    console.log(page);
    // page.onFrame();
})()
.catch(err => console.error(err));