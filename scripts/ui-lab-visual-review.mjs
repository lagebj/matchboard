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
// `interactions` (PR #777 remediation, A01/A12 finding): optional extra captures of the SAME
// page, in the SAME browser context (no reload), after performing a deterministic interaction —
// proves initial render AND the reviewable interaction state, and that the action never navigates.
const scenarios = [
  { slug: "match-preparation", route: "atlas-followup/match-preparation" },
  { slug: "completed-match", route: "atlas-followup/completed-match" },
  { slug: "player-detail", route: "atlas-followup/player-detail" },
  { slug: "position-map", route: "atlas-followup/position-map" },
  // Gate A W1 candidates (programme_v054 `20_UI_LAB_CANDIDATE_WAVES.md`) — CANDIDATE, not approved.
  {
    slug: "gate-a-a01-sports-first",
    route: "gate-a/a01-sports-first",
    // Owner/independent review follow-up: verify the 600-840px range where the contextual
    // inspector turns on (useMediaQuery's 600px threshold) but the row layout hasn't yet engaged
    // (Touchline's wider `expanded`, 840px, breakpoint) — the exact range a fixed-width two-column
    // layout would have squeezed, before the row/stacked decoupling fix.
    extraViewports: [
      { name: "tablet-600", width: 600, height: 900 },
      { name: "tablet-768", width: 768, height: 1024 },
      { name: "tablet-900", width: 900, height: 1024 },
    ],
    interactions: [
      {
        id: "lineup-open",
        perform: async (page) => {
          await page.getByText("Lineup", { exact: true }).click();
          await page.getByTestId("lineup-preview-list").waitFor({ state: "visible", timeout: 10000 });
          // Two different presentations open here depending on viewport (A01 final correction):
          // the mobile TouchlineBottomSheet (aria-modal="true", fixed overlay, slides in via a
          // CSS-transform/requestAnimationFrame state flip) or the desktop LineupContextualInspector
          // (aria-modal="false", plain inline flow, no animation at all). Only the sheet needs a
          // settle wait — it's already DOM-"visible" mid-transform, off-screen, the instant it
          // mounts (CSS transforms don't affect visibility). The inspector has nothing to settle,
          // and on a stacked (600-840px) layout its natural position legitimately extends below the
          // viewport fold — waiting for it to be "flush with the viewport bottom" would hang
          // forever, which is exactly what happened here before this fix.
          const isSheet = await page.evaluate(() => document.querySelector('[role="dialog"]')?.getAttribute("aria-modal") === "true");
          if (isSheet) {
            // A `getComputedStyle().transform` read was tried here first and proved unreliable (it
            // can report the settled value a moment before the dialog's actual rendered position/
            // boundingClientRect catches up) — wait on the real rendered position instead: once
            // settled, the sheet's bottom edge sits flush with the viewport bottom; mid-transition
            // (or pre-transition) it extends below it.
            await page.waitForFunction(() => {
              const dialog = document.querySelector('[role="dialog"]');
              if (!dialog) return false;
              const rect = dialog.getBoundingClientRect();
              return rect.height > 0 && rect.bottom <= window.innerHeight + 2;
            }, { timeout: 10000 });
            await page.waitForTimeout(100); // settle grace period
          }
        },
      },
    ],
  },
  { slug: "gate-a-a02-match-lifecycle", route: "gate-a/a02-match-lifecycle" },
  { slug: "gate-a-a06-position-pitches", route: "gate-a/a06-position-pitches" },
  {
    slug: "gate-a-a12-profile-editor",
    route: "gate-a/a12-profile-editor",
    interactions: [
      {
        id: "editor-expanded",
        perform: async (page) => {
          await page.getByRole("button", { name: "Edit" }).click();
          await page.getByRole("combobox").first().waitFor({ state: "visible", timeout: 10000 });
        },
      },
    ],
  },
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
  for (const scenario of scenarios) for (const viewport of [...viewports, ...(scenario.extraViewports ?? [])]) for (const theme of ["dark","light"]) {
    // Width-based, not name-based: correct for any current or future viewport, including the
    // tablet-* extras above, without special-casing each new name.
    const isNarrowDevice = viewport.width < 600;
    const context = await browser.newContext({
      viewport:{width:viewport.width,height:viewport.height},
      isMobile:isNarrowDevice,hasTouch:isNarrowDevice,
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
      const initialName=scenario.slug+"-"+viewport.name+"-"+theme+".png";
      const initialPath = path.join(output,initialName);
      await page.screenshot({path:initialPath,fullPage:true,animations:"disabled",caret:"hide"});
      const initialSha256 = createHash("sha256").update(await readFile(initialPath)).digest("hex");
      records.push({
        scenario: scenario.slug,
        route: scenario.route,
        viewport: viewport.name,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        theme,
        interactionState: "initial",
        file: initialName,
        sha256: initialSha256,
      });
      console.log("Captured "+initialName+" sha256="+initialSha256);

      for (const interaction of scenario.interactions ?? []) {
        await interaction.perform(page);
        const urlBefore = url.pathname;
        if (page.url() && new URL(page.url()).pathname !== urlBefore) {
          throw new Error(
            scenario.slug+" interaction '"+interaction.id+"' navigated away from "+urlBefore+" to "+page.url()+" — context-local actions must not navigate.",
          );
        }
        const name=scenario.slug+"-"+viewport.name+"-"+theme+"-"+interaction.id+".png";
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
          interactionState: interaction.id,
          file: name,
          sha256,
        });
        console.log("Captured "+name+" sha256="+sha256);
      }
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
