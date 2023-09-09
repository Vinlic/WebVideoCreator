import Pool from "./lib/Pool.js";

const pool = new Pool({ numBrowserMin: 1, numBrowserMax: 1, browserOptions: { numPageMin: 1, numPageMax: 1 } });

(async () => {
    await pool.warmup();
    
})()
.catch(err => console.error(err));