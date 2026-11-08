import { test, expect } from "@playwright/test";

/**
 * B08 W5 remediation (independent review, section 11 "Browser-based acceptance coverage") — real
 * Chromium assertions for B08's lifecycle continuity, navigation, and responsive layout. Runs
 * under the `ui-lab-b08` project only (`playwright.config.ts`), against the same local `next dev`
 * server `scripts/ui-lab-visual-review.mjs` already starts in CI
 * (`.github/workflows/ui-lab-visual-review.yml`). No auth, no database — `/dev/ui-lab` is
 * explicitly unauthenticated (`src/app/dev/ui-lab/layout.tsx`).
 *
 * Each `test()` gets Playwright's own fresh, isolated browser context — the sessionStorage-backed
 * B08 journey (`shared/b08-journey.ts`) is therefore always empty at the start of every test, the
 * same "reference snapshot" guarantee every CI capture already relies on.
 */

const BASE = "/dev/ui-lab/gate-b/b08-information-ownership";

test.describe("B08 — navigation and lifecycle-state continuity", () => {
  test("BEFORE's primary action opens LIVE with the same match identity, and real browser Back returns to BEFORE", async ({ page }) => {
    await page.goto(`${BASE}/before`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Before match");
    // A real <Link> navigation (unlike an in-page tab switch, which uses router.replace and
    // deliberately does not push history) — genuinely exercises the browser's own history stack.
    await page.getByRole("link", { name: "Start live reporting" }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/live$`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Live");

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${BASE}/before$`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Before match");
  });

  test("LIVE's own back link returns to BEFORE", async ({ page }) => {
    await page.goto(`${BASE}/live`);
    await page.getByRole("link", { name: /Back to this match/ }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/before$`));
  });

  test("a direct visit to AFTER (no journey) shows the reference snapshot: report incomplete, 2-1", async ({ page }) => {
    await page.goto(`${BASE}/after`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("report incomplete");
    await expect(page.getByText("Needs work", { exact: true })).toBeVisible();
  });

  test("AFTER's primary action opens REPORT-DRAFT", async ({ page }) => {
    await page.goto(`${BASE}/after`);
    await page.getByRole("link", { name: "Continue report" }).first().click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/report-draft`));
  });

  test("completing REPORT-DRAFT in place, then returning to Match Details, shows the COMPLETED state — not the stale draft/incomplete one (P1-5)", async ({ page }) => {
    await page.goto(`${BASE}/report-draft?tab=players`);
    await page.getByRole("button", { name: "Confirm duration", exact: true }).click();
    await expect(page.getByText("Confirm duration", { exact: true })).toHaveCount(0);

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Complete report", exact: true }).click();
    await expect(page.getByRole("button", { name: "Reopen report", exact: true })).toBeVisible();

    // Both back-links must now carry the completed variant (P1-5/P1-6 — SafePostMatchReportShell's
    // own internal link, and this page's own top breadcrumb).
    await expect(page.getByRole("link", { name: "‹ Back to match" })).toHaveAttribute("href", new RegExp(`${BASE}/after\\?report=completed$`));
    await expect(page.getByRole("link", { name: "← Back to match (After)" })).toHaveAttribute("href", new RegExp(`${BASE}/after\\?report=completed`));

    await page.getByRole("link", { name: "‹ Back to match" }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/after\\?report=completed`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText("report completed");
    await expect(page.getByText("Completed", { exact: true })).toBeVisible();
    await expect(page.getByText("Needs work", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "View report" })).toHaveAttribute("href", new RegExp(`${BASE}/report-completed$`));
  });

  test("REPORT-COMPLETED's own back link also preserves the completed state on return to AFTER", async ({ page }) => {
    await page.goto(`${BASE}/report-completed`);
    await page.getByRole("link", { name: "‹ Back to match" }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/after\\?report=completed`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText("report completed");
  });

  test("an invalid report tab falls back to the real default without showing stale content, once locked", async ({ page }) => {
    await page.goto(`${BASE}/report-completed?tab=review`);
    // "review" is DRAFT-only; COMPLETED replaces it with "combinations" — the real resolver falls
    // back to the surface's own default (summary), never leaving the stale Review content visible.
    await expect(page.getByText(/Plan integrity review/)).toHaveCount(0);
  });

  test("reload preserves the selected tab on REPORT-DRAFT (a direct URL visit)", async ({ page }) => {
    // The report's own tab rail renders plain buttons wired to router.replace() (no per-tab
    // href, and replace() deliberately does not push a new history entry — selecting a tab is
    // not something browser Back is expected to undo in this app). Reload is tested directly
    // against a URL carrying the tab, rather than via a click, for exactly that reason.
    await page.goto(`${BASE}/report-draft?tab=timeline`);
    await expect(page.getByRole("button", { name: "Timeline" })).toHaveAttribute("aria-current", "page");
    await page.reload();
    await expect(page.getByRole("button", { name: "Timeline" })).toHaveAttribute("aria-current", "page");
  });
});

test.describe("B08 — LIVE-to-report continuity (P1-6): a real recorded live event reaches the report, an un-recorded one genuinely does not", () => {
  test("finishing LIVE without recording the 48' winner leaves REPORT-DRAFT showing a real 1-1 — not the fixed canonical 2-1", async ({ page }) => {
    await page.goto(`${BASE}/live`);
    await expect(page.getByRole("button", { name: "Finish live reporting" })).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Finish live reporting" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Confirm" }).click();

    // handleEndSession navigates via its injected actions.reportUrl() once endSession() returns a
    // reportId — a real window.location.href hard navigation, not a client-side route change.
    await page.waitForURL(new RegExp(`${BASE}/report-draft`), { timeout: 15_000 });
    await expect(page.getByText(/Reflecting your LIVE session/)).toBeVisible();
    await expect(page.getByText("1 - 1").first()).toBeVisible();
  });

  test("recording the 48' winner live (scorer skipped) before finishing carries it through to REPORT-DRAFT as a real 2-1", async ({ page }) => {
    await page.goto(`${BASE}/live`);
    await expect(page.getByRole("button", { name: "Goal for us" })).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Goal for us" }).click();
    // Goal recording opens a "Who scored?" sheet — dismiss it via its own real "Skip" control
    // (same production pattern e2e/live-reporting.spec.ts already proves against the real,
    // authenticated live-reporting flow) so it doesn't intercept the next click.
    await page.getByRole("button", { name: "Skip" }).click();

    await page.getByRole("button", { name: "Finish live reporting" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Confirm" }).click();

    await page.waitForURL(new RegExp(`${BASE}/report-draft`), { timeout: 15_000 });
    await expect(page.getByText(/Reflecting your LIVE session/)).toBeVisible();
    await expect(page.getByText("2 - 1").first()).toBeVisible();
  });
});

test.describe("B08 — responsive layout: no horizontal page overflow at any required width", () => {
  const SCENARIOS = ["before", "live", "after", "report-draft", "report-completed"];
  const WIDTHS = [320, 360, 390, 430, 600, 768, 900, 1440];

  for (const scenario of SCENARIOS) {
    for (const width of WIDTHS) {
      test(`${scenario} @ ${width}px has no document-level horizontal overflow`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${BASE}/${scenario}`);
        await page.locator("h1").first().waitFor({ state: "visible" });
        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        expect(scrollWidth).toBeLessThanOrEqual(innerWidth + 1);
      });
    }
  }
});
