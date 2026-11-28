import { test, expect, type Page } from "@playwright/test";

/**
 * Shared Match Presentation correction — issues #852 (scheduled kickoff-time overflow /
 * mobile opponent truncation) and #853 (unqualified "FT" for an unconfirmed match). Real browser
 * geometry assertions against the actual, unmodified production `ScorebookMatchRow` via the
 * dedicated regression fixture (`/dev/ui-lab/scorebook-match-row` — not a UI Lab design
 * candidate, no auth, no database, same convention `ui-lab-gate-e.spec.ts` documents). jsdom
 * component tests cover text-content correctness; this file covers what only a real layout
 * engine can verify — bounding-box overlap, truncation, and document-level overflow.
 */
test.skip(
  process.env.PLAYWRIGHT_BASE_URL?.includes("app.matchboard.football") ?? false,
  "/dev/ui-lab/** is production-only notFound() — this spec never targets production.",
);

const BASE = "/dev/ui-lab/scorebook-match-row";

const VIEWPORTS = [
  { label: "desktop (1440x900)", width: 1440, height: 900 },
  { label: "mobile (390x844)", width: 390, height: 844 },
  { label: "narrow (320x720)", width: 320, height: 720 },
];

const THEMES: ("light" | "dark")[] = ["light", "dark"];

/** Whether an element's own text is being clipped by CSS truncation (`text-overflow: ellipsis` +
 * `overflow: hidden`) — `scrollWidth` exceeding `clientWidth` is the standard real-DOM signal;
 * jsdom cannot compute either. */
async function isTruncated(page: Page, testId: string, text: string) {
  const locator = page.getByTestId(testId).getByText(text, { exact: true });
  return locator.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
}

for (const viewport of VIEWPORTS) {
  for (const theme of THEMES) {
    test.describe(`ScorebookMatchRow at ${viewport.label}, ${theme}`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.emulateMedia({ colorScheme: theme });
        await page.goto(BASE);
        await expect(page.getByTestId("row-scheduled-long-opponent-home")).toBeVisible();
      });

      test("issue #852: the scheduled kickoff time never overlaps the trailing status label", async ({ page }) => {
        const row = page.getByTestId("row-scheduled-long-opponent-home");
        const time = row.getByTestId("scorebook-row-time");
        const trailing = row.getByTestId("scorebook-row-trailing");
        await expect(time).toBeVisible();
        await expect(trailing).toBeVisible();
        const timeBox = await time.boundingBox();
        const trailingBox = await trailing.boundingBox();
        expect(timeBox).not.toBeNull();
        expect(trailingBox).not.toBeNull();
        if (!timeBox || !trailingBox) return;
        // Non-intersecting rectangles: the time box ends at or before the trailing box starts.
        const intersects =
          timeBox.x < trailingBox.x + trailingBox.width &&
          timeBox.x + timeBox.width > trailingBox.x &&
          timeBox.y < trailingBox.y + trailingBox.height &&
          timeBox.y + timeBox.height > trailingBox.y;
        expect(intersects).toBe(false);
      });

      test("issue #852: 'Scheduled' remains readable and the opponent name stays identifiable", async ({ page }) => {
        const row = page.getByTestId("row-scheduled-long-opponent-home");
        await expect(row.getByText("Scheduled")).toBeVisible();
        // At every tested width, the full opponent name is visible somewhere in the row — either
        // not truncated at all, or (320px only) still present on a wrapped secondary line.
        await expect(row.getByText("Nordbyen FK", { exact: true })).toBeVisible();
        if (viewport.width >= 390) {
          expect(await isTruncated(page, "row-scheduled-long-opponent-home", "Nordbyen FK")).toBe(false);
        }
      });

      test("no document-level horizontal overflow", async ({ page }) => {
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(1);
      });

      test("completed score alignment and outcome rendering remain correct", async ({ page }) => {
        const win = page.getByTestId("row-done-win");
        // `toContainText()` reads rendered (innerText-based) content, so it only sees whichever of
        // the `medium:hidden` / `hidden medium:inline` FT variants CSS currently shows.
        await expect(win.getByTestId("scorebook-row-trailing")).toContainText(/^FT/);
        await expect(win.getByText("2", { exact: true })).toBeVisible();
        await expect(win.getByText("1", { exact: true })).toBeVisible();

        // Real alignment geometry, not just text presence: the home and away score values share
        // one stable right-aligned value lane (ADR-0125 §1) — their right edges must match.
        const scoreBoxes = await win.locator(".tl-score-list").evaluateAll((els) =>
          els.map((el) => {
            const r = el.getBoundingClientRect();
            return r.x + r.width;
          }),
        );
        expect(scoreBoxes).toHaveLength(2);
        expect(Math.abs(scoreBoxes[0]! - scoreBoxes[1]!)).toBeLessThanOrEqual(1);
      });

      test("live and cancelled rows render correctly", async ({ page }) => {
        const live = page.getByTestId("row-live");
        await expect(live.getByText(/LIVE/)).toBeVisible();

        const cancelled = page.getByTestId("row-cancelled");
        await expect(cancelled.getByText("Cancelled")).toBeVisible();
        await expect(cancelled.getByText("Opponent withdrew")).toBeVisible();
      });

      test("issue #853: a played (no report) row never shows FT", async ({ page }) => {
        const row = page.getByTestId("row-played-no-report");
        await expect(row.getByText("Played")).toBeVisible();
        await expect(row.getByText(/^FT/)).toHaveCount(0);
      });

      test("issue #853: a report_incomplete (draft) row never shows FT, even though its draft score stays visible", async ({
        page,
      }) => {
        const row = page.getByTestId("row-report-draft");
        await expect(row.getByText("Report incomplete")).toBeVisible();
        await expect(row.getByText(/^FT/)).toHaveCount(0);
        await expect(row.getByText("3", { exact: true })).toBeVisible();
        await expect(row.getByText("1", { exact: true })).toBeVisible();
      });

      test("every row stays a keyboard-focusable link to its match", async ({ page }) => {
        const row = page.getByTestId("row-done-win").locator("a");
        await expect(row).toHaveAttribute("href", /row-done-win/);
        await row.focus();
        await expect(row).toBeFocused();
      });
    });
  }
}
