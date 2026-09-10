/**
 * Quick local axe scan of the /dev/ui-lab screens — a smoke check for the
 * axe-core background-compositing class of bug (color-mix / background-image on
 * ancestors making contrast indeterminate). Not a substitute for the real
 * e2e/accessibility.spec.ts against the deployed slot. Local, dev-server only.
 *
 *   npx next dev -p 3334
 *   BASE_URL=http://localhost:3334 npx tsx scripts/ui-lab-axe-check.ts
 */
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3334";
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const PATHS = [
  "/dev/ui-lab/league?viewport=desktop",
  "/dev/ui-lab/today?viewport=compact",
  "/dev/ui-lab/event-day?viewport=compact",
  "/dev/ui-lab/round-board?viewport=desktop",
  "/dev/ui-lab/follow-live?viewport=compact",
  "/dev/ui-lab/insights?viewport=compact",
];

async function main() {
  const browser = await chromium.launch();
  let total = 0;
  for (const p of PATHS) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}${p}`, { waitUntil: "networkidle" });
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    const contrast = violations.filter((v) => v.id === "color-contrast");
    total += violations.length;
    console.log(
      `${violations.length === 0 ? "✓" : "✗"} ${p}  — ${violations.length} violation(s)` +
        (violations.length ? `  [${violations.map((v) => v.id).join(", ")}]` : ""),
    );
    for (const v of contrast) {
      for (const n of v.nodes.slice(0, 4)) {
        console.log(`    contrast: ${n.html.slice(0, 100)}`);
        for (const c of n.any) {
          const d = c.data as { fgColor?: string; bgColor?: string; contrastRatio?: number };
          if (d?.fgColor) console.log(`      fg ${d.fgColor} on bg ${d.bgColor} = ${d.contrastRatio}`);
        }
      }
    }
    await ctx.close();
  }
  await browser.close();
  console.log(total === 0 ? "\nAll clean." : `\n${total} total violation(s).`);
  process.exit(total === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
