/**
 * Touchline Finish & Visual Convergence follow-up — extended UI Lab
 * screenshot capture (`10_REFERENCE_CONFORMANCE.md §4`, F4 gate).
 *
 * Standalone Playwright runner — NOT a `@playwright/test` spec (same
 * separation as `scripts/docs-screenshots.ts` / `scripts/ui-lab-screenshots.ts`).
 * Captures the seven follow-up UI Lab routes at their reference viewports,
 * dark and light where the golden set specifies both.
 *
 * Usage:
 *   1. start the dev server:  npx next dev -p 3334
 *   2. run:  BASE_URL=http://localhost:3334 npx tsx scripts/touchline-finish-screenshots.ts
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3334";
const OUT_DIR = path.join(process.cwd(), "artifacts/touchline-finish/ui-lab");

if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE_URL)) {
  console.error(`Refusing non-local BASE_URL: ${BASE_URL}`);
  process.exit(1);
}

type Shot = {
  name: string;
  pathname: string;
  width: number;
  height: number;
  themes: ("dark" | "light")[];
};

const SHOTS: Shot[] = [
  { name: "shell-light-desktop", pathname: "/dev/ui-lab/shell-light?viewport=desktop", width: 1440, height: 900, themes: ["light"] },
  { name: "shell-desktop", pathname: "/dev/ui-lab/shell-light?viewport=desktop", width: 1440, height: 900, themes: ["dark"] },
  { name: "shell-mobile", pathname: "/dev/ui-lab/shell-mobile?viewport=compact", width: 390, height: 844, themes: ["dark", "light"] },
  { name: "event-squad-mobile", pathname: "/dev/ui-lab/event-squad?viewport=compact", width: 390, height: 844, themes: ["dark", "light"] },
  { name: "lineup-mobile", pathname: "/dev/ui-lab/lineup?viewport=compact", width: 390, height: 844, themes: ["dark", "light"] },
  { name: "lineup-desktop", pathname: "/dev/ui-lab/lineup?viewport=desktop", width: 1440, height: 900, themes: ["dark"] },
  { name: "live-reporting-mobile", pathname: "/dev/ui-lab/live-reporting?viewport=compact", width: 390, height: 844, themes: ["dark", "light"] },
  { name: "player-detail-mobile", pathname: "/dev/ui-lab/player-detail?viewport=compact", width: 390, height: 844, themes: ["dark", "light"] },
  { name: "player-detail-desktop", pathname: "/dev/ui-lab/player-detail?viewport=desktop", width: 1440, height: 900, themes: ["dark"] },
  { name: "tactics-desktop", pathname: "/dev/ui-lab/tactics?viewport=desktop", width: 1440, height: 900, themes: ["dark", "light"] },
  { name: "tactics-mobile", pathname: "/dev/ui-lab/tactics?viewport=compact", width: 390, height: 844, themes: ["dark"] },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();

  for (const shot of SHOTS) {
    for (const theme of shot.themes) {
      const context = await browser.newContext({
        viewport: { width: shot.width, height: shot.height },
        deviceScaleFactor: 2,
        colorScheme: theme,
      });
      const page = await context.newPage();
      const sep = shot.pathname.includes("?") ? "&" : "?";
      const url = `${BASE_URL}${shot.pathname}${sep}theme=${theme}`;
      await page.goto(url, { waitUntil: "networkidle" });
      await page.addStyleTag({
        content:
          "nextjs-portal,#__next-build-watcher,[data-nextjs-dev-tools-button],[data-nextjs-toast]{display:none !important}",
      });
      await page.evaluate(() => (document as unknown as { fonts: FontFaceSet }).fonts.ready);
      await page.waitForTimeout(250);

      const suffix = theme === "dark" ? "" : "-light";
      const file = path.join(OUT_DIR, `${shot.name}${suffix}.png`);
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
