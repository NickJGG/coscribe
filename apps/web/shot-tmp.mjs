import { chromium } from "playwright";
const [url, out, w, h] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +(w || 1500), height: +(h || 1000) } });
p.on("pageerror", (e) => console.log("pageerror:", e.message));
await p.goto(url);
await p.waitForTimeout(1500);
await p.screenshot({ path: out });
await b.close();
