/**
 * UI Lab screenshot capture (ADR-0134, bundle `13_UI_LAB_AND_GOLDEN_GATE.md §6`).
 *
 * Standalone Playwright runner — NOT a `@playwright/test` spec, so it can never
 * affect the Browser Acceptance suite (same separation as
 * `scripts/docs-screenshots.ts`). Captures the seven golden reference screens
 * (dark, primary) plus a light-theme set as accessibility-gate evidence.
 *
 * Usage:
 *   1. start the dev server:  npx next dev -p 3334
 *   2. run:  BASE_URL=http://localhost:3334 npx tsx scripts/ui-lab-screenshots.ts
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3334";
const OUT_DIR = path.join(process.cwd(), "artifacts/visual-reset/ui-lab");

if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE_URL)) {
  console.error(`Refusing non-local BASE_URL: ${BASE_URL}`);
  process.exit(1);
}

type Shot = {
  name: string;
  pathname: string;
  width: number;
  height: number;
};

const SHOTS: Shot[] = [
  { name: "league-desktop", pathname: "/dev/ui-lab/league?viewport=desktop", width: 1440, height: 900 },
  { name: "league-mobile", pathname: "/dev/ui-lab/league?viewport=compact", width: 390, height: 844 },
  { name: "today-mobile", pathname: "/dev/ui-lab/today?viewport=compact", width: 390, height: 844 },
  { name: "event-day-mobile", pathname: "/dev/ui-lab/event-day?viewport=compact", width: 390, height: 844 },
  { name: "round-board-desktop", pathname: "/dev/ui-lab/round-board?viewport=desktop", width: 1440, height: 900 },
  { name: "follow-live-mobile", pathname: "/dev/ui-lab/follow-live?viewport=compact", width: 390, height: 844 },
  { name: "insights-mobile", pathname: "/dev/ui-lab/insights?viewport=compact", width: 390, height: 844 },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();

  for (const theme of ["dark", "light"] as const) {
    for (const shot of SHOTS) {
      const context = await browser.newContext({
        viewport: { width: shot.width, height: shot.height },
        deviceScaleFactor: 2,
        colorScheme: theme,
      });
      const page = await context.newPage();
      const sep = shot.pathname.includes("?") ? "&" : "?";
      const url = `${BASE_URL}${shot.pathname}${sep}theme=${theme}`;
      await page.goto(url, { waitUntil: "networkidle" });
      // Hide the Next.js dev-mode indicator so it is not in the capture.
      await page.addStyleTag({
        content:
          "nextjs-portal,#__next-build-watcher,[data-nextjs-dev-tools-button],[data-nextjs-toast]{display:none !important}",
      });
      // Let Barlow Condensed settle so there is no font-swap in the capture.
      await page.evaluate(() => (document as unknown as { fonts: FontFaceSet }).fonts.ready);
      await page.waitForTimeout(250);

      const suffix = theme === "dark" ? "" : "-light";
      const file = path.join(OUT_DIR, `${shot.name}${suffix}.png`);
      // Viewport-clipped (not fullPage) so the framing matches the golden refs and
      // the fixed floating bottom nav sits at the true viewport bottom.
      await page.screenshot({ path: file, fullPage: false });
      console.log(`✓ ${path.relative(process.cwd(), file)}  (${shot.width}×${shot.height}, ${theme})`);
      await context.close();
    }
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
