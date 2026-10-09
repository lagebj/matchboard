import { chromium } from "playwright";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

// Fixture-only visual evidence, not an approved golden. Never access production.
const base = new URL(process.env.UI_LAB_BASE_URL ?? "http://127.0.0.1:3333");
if (!["127.0.0.1", "localhost"].includes(base.hostname)) throw new Error("Local UI Lab only");
const output = path.resolve("test-results/ui-lab-review");

function resolveCommitSha() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}
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
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
  { name: "narrow", width: 320, height: 720 },
];
const records = [];
await mkdir(output,{recursive:true});
const browser = await chromium.launch();
try {
  for (const scenario of scenarios) for (const viewport of viewports) for (const theme of ["dark","light"]) {
    const context = await browser.newContext({
      viewport:{width:viewport.width,height:viewport.height},
      isMobile:viewport.name!=="desktop",hasTouch:viewport.name!=="desktop",
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
      const filePath = path.join(output,name);
      await page.screenshot({path:filePath,fullPage:true,animations:"disabled",caret:"hide"});
      const sha256 = createHash("sha256").update(await readFile(filePath)).digest("hex");
      records.push({
        scenario: scenario.slug,
        route: scenario.route,
        viewport: viewport.name,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        theme,
        file: name,
        sha256,
      });
      console.log("Captured "+name+" sha256="+sha256);
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  const sourceCommitSha = resolveCommitSha();
  await writeFile(path.join(output,"manifest.json"),JSON.stringify({
    description:"Temporary UI Lab visual-review evidence; requires human approval. Not an approved golden.",
    sourceCommitSha,
    generatedAt:new Date().toISOString(),
    environment:{node:process.version,platform:process.platform,ci:Boolean(process.env.CI)},
    knownLimitations:[
      "Captured against a local/ephemeral dev server, not a production or preview deployment.",
      "Gate A scenarios (scenario slugs prefixed gate-a-) are CANDIDATE only — see docs/ui-lab/gate-a-w1-candidates/.",
    ],
    approvalStatus:"CANDIDATE",
    captures:records,
  },null,2)+"\n");
}
