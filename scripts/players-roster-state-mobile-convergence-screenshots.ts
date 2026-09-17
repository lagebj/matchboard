/**
 * Players roster-state-and-mobile-convergence pass — screenshot capture.
 *
 * Standalone Playwright runner (not a `@playwright/test` spec — same separation as
 * `scripts/ui-lab-screenshots.ts` and `scripts/players-visual-convergence-screenshots.ts`).
 * Captures the required states from `07_...`-style visual gates for this pass: expanded desktop
 * Active roster, expanded desktop Removed roster, 390px Active roster, 390px opportunity
 * attention, and 390px Inactive roster.
 *
 * Usage:
 *   1. start the dev server:  npm run dev   (binds :3333)
 *   2. run:  BASE_URL=http://localhost:3333 npx tsx scripts/players-roster-state-mobile-convergence-screenshots.ts
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3333";
const OUT_DIR = path.join(process.cwd(), "artifacts/players-roster-state-mobile-convergence");

if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE_URL)) {
  console.error(`Refusing non-local BASE_URL: ${BASE_URL}`);
  process.exit(1);
}

const PLAYERS_OVERVIEW_URL = (state: string) =>
  `${BASE_URL}/dev/ui-lab/atlas-followup/players-overview?mode=overview&state=${state}`;

type Shot = {
  name: string;
  url: string;
  width: number;
  height: number;
  theme: "dark" | "light";
};

const SHOTS: Shot[] = [
  { name: "01-desktop-active-dark", url: PLAYERS_OVERVIEW_URL("players-overview-selected"), width: 1440, height: 900, theme: "dark" },
  { name: "02-desktop-removed-dark", url: PLAYERS_OVERVIEW_URL("players-overview-removed"), width: 1440, height: 900, theme: "dark" },
  { name: "03-mobile-active-dark", url: PLAYERS_OVERVIEW_URL("players-overview-mobile"), width: 390, height: 844, theme: "dark" },
  { name: "04-mobile-opportunity-attention-dark", url: PLAYERS_OVERVIEW_URL("players-overview-opportunity-gap"), width: 390, height: 844, theme: "dark" },
  { name: "05-mobile-inactive-dark", url: PLAYERS_OVERVIEW_URL("players-overview-inactive"), width: 390, height: 844, theme: "dark" },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();

  for (const shot of SHOTS) {
    const context = await browser.newContext({
      viewport: { width: shot.width, height: shot.height },
      deviceScaleFactor: 2,
      colorScheme: shot.theme,
    });
    // Set the persisted appearance before any script runs — matches how a real user's
    // stored preference is honored before first paint (`THEME_INIT_SCRIPT`).
    await context.addInitScript((theme) => {
      window.localStorage.setItem("matchboard-theme", theme);
    }, shot.theme);
    const page = await context.newPage();
    await page.goto(shot.url, { waitUntil: "networkidle" });
    await page.addStyleTag({
      content: "nextjs-portal,#__next-build-watcher,[data-nextjs-dev-tools-button],[data-nextjs-toast]{display:none !important}",
    });
    await page.evaluate(() => (document as unknown as { fonts: FontFaceSet }).fonts.ready);
    await page.waitForTimeout(250);

    const file = path.join(OUT_DIR, `${shot.name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log(`✓ ${path.relative(process.cwd(), file)}  (${shot.width}×${shot.height}, ${shot.theme})`);
    await context.close();
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
