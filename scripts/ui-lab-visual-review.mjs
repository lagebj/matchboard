import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Fixture-only visual evidence, not an approved golden. Never access production.
const base = new URL(process.env.UI_LAB_BASE_URL ?? "http://127.0.0.1:3333");
if (!["127.0.0.1", "localhost"].includes(base.hostname)) throw new Error("Local UI Lab only");
const output = path.resolve("test-results/ui-lab-review");
const scenarios = ["match-preparation", "completed-match", "player-detail", "position-map"];
const viewports = [{name:"desktop",width:1440,height:900},{name:"mobile",width:390,height:844}];
const records = [];
await mkdir(output,{recursive:true});
const browser = await chromium.launch();
try {
  for (const scenario of scenarios) for (const viewport of viewports) for (const theme of ["dark","light"]) {
    const context = await browser.newContext({
      viewport:{width:viewport.width,height:viewport.height},
      isMobile:viewport.name==="mobile",hasTouch:viewport.name==="mobile",
      colorScheme:theme,reducedMotion:"reduce",deviceScaleFactor:1,
    });
    try {
      const page = await context.newPage();
      const url = new URL("/dev/ui-lab/atlas-followup/"+scenario,base);
      url.searchParams.set("theme",theme);
      const response = await page.goto(url.toString(),{waitUntil:"networkidle",timeout:90000});
      if (response?.status()!==200) throw new Error(url.pathname+": HTTP "+response?.status());
      await page.locator("h1").first().waitFor({state:"visible",timeout:30000});
      await page.locator('.touchline[data-theme="'+theme+'"]').first().waitFor({state:"attached",timeout:30000});
      await page.evaluate(()=>document.fonts.ready);
      await page.addStyleTag({content:"nextjs-portal,#__next-build-watcher,[data-nextjs-dev-tools-button],[data-nextjs-toast]{display:none!important}"});
      const name=scenario+"-"+viewport.name+"-"+theme+".png";
      await page.screenshot({path:path.join(output,name),fullPage:true,animations:"disabled",caret:"hide"});
      records.push({scenario,viewport:viewport.name,dimensions:viewport.width+"x"+viewport.height,theme,file:name});
      console.log("Captured "+name);
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  await writeFile(path.join(output,"manifest.json"),JSON.stringify({
    description:"Temporary UI Lab visual-review evidence; requires human approval",
    commit:process.env.GITHUB_SHA??"local",generatedAt:new Date().toISOString(),captures:records,
  },null,2)+"\n");
}
