import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Fixture-only visual evidence, not an approved golden. Never access production.
const base = new URL(process.env.UI_LAB_BASE_URL ?? "http://127.0.0.1:3333");
if (!["127.0.0.1", "localhost"].includes(base.hostname)) throw new Error("Local UI Lab only");
const output = path.resolve("test-results/ui-lab-review");
// `slug` names the output file; `route` is the dev UI Lab path under /dev/ui-lab/.
const scenarios = [
  { slug: "match-preparation", route: "atlas-followup/match-preparation" },
  { slug: "completed-match", route: "atlas-followup/completed-match" },
  { slug: "player-detail", route: "atlas-followup/player-detail" },
  { slug: "position-map", route: "atlas-followup/position-map" },
  // Gate A W1 candidates (programme_v054 `20_UI_LAB_CANDIDATE_WAVES.md`) — CANDIDATE, not approved.
  { slug: "gate-a-a01-sports-first", route: "gate-a/a01-sports-first" },
  { slug: "gate-a-a02-match-lifecycle", route: "gate-a/a02-match-lifecycle" },
  { slug: "gate-a-a06-position-pitches", route: "gate-a/a06-position-pitches" },
  { slug: "gate-a-a12-profile-editor", route: "gate-a/a12-profile-editor" },
];
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
      const url = new URL("/dev/ui-lab/"+scenario.route,base);
      url.searchParams.set("theme",theme);
      const response = await page.goto(url.toString(),{waitUntil:"networkidle",timeout:90000});
      if (response?.status()!==200) throw new Error(url.pathname+": HTTP "+response?.status());
      await page.locator("h1").first().waitFor({state:"visible",timeout:30000});
      await page.locator('.touchline[data-theme="'+theme+'"]').first().waitFor({state:"attached",timeout:30000});
      await page.evaluate(()=>document.fonts.ready);
      await page.addStyleTag({content:"nextjs-portal,#__next-build-watcher,[data-nextjs-dev-tools-button],[data-nextjs-toast]{display:none!important}"});
      const name=scenario.slug+"-"+viewport.name+"-"+theme+".png";
      await page.screenshot({path:path.join(output,name),fullPage:true,animations:"disabled",caret:"hide"});
      records.push({scenario:scenario.slug,viewport:viewport.name,dimensions:viewport.width+"x"+viewport.height,theme,file:name});
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
