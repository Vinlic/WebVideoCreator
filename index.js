import Pool from "./lib/Pool.js";

const pool = new Pool({ numBrowserMin: 1, numBrowserMax: 1, browserOptions: { numPageMin: 1, numPageMax: 1 } });

(async () => {
    await pool.warmup();
    const page = await pool.acquirePage();
    page.goto("https://threejs.org/examples/#webgl_animation_keyframes");
    console.log("啊啊");
})()
.catch(err => console.error(err));