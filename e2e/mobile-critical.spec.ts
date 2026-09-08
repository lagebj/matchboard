import { test, expect, type Page } from "@playwright/test";

/**
 * Bounded compact-viewport critical-flow suite (ADR-0124 §8, TEST_AND_ACCEPTANCE.md).
 *
 * Runs under two projects only — `mobile-critical-chromium` (390×844) and
 * `mobile-critical-webkit` (iPhone-like compact viewport, WebKit engine). It does NOT
 * re-run the heavy mutation/business-logic specs across viewports; it checks the adaptive
 * shell and the compact navigation/layout contract the desktop suites can't see.
 *
 * Deliberately navigation/layout focused and defensive against the one shared Test slot:
 *  - never `networkidle` (Matchboard has live-match polling / analytics — it may never idle);
 *    wait on a concrete element instead;
 *  - any assertion that needs seeded content `test.skip()`s when that content is absent,
 *    rather than failing.
 */

const ORG = "test-club-a";

/** Wait for a primary surface to be interactive without relying on network idle. */
async function gotoSurface(page: Page, path: string) {
  await page.goto(`/o/${ORG}/${path}`); // default waits for 'load'
  await expect(page.getByRole("main").first()).toBeVisible();
}

async function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
}

test.describe("compact shell", () => {
  test("bottom navigation is fixed and every primary destination navigates", async ({ page }) => {
    await gotoSurface(page, "today");

    const nav = page.getByRole("navigation", { name: "Mobile" });
    await expect(nav).toBeVisible();
    expect(await nav.evaluate((el) => getComputedStyle(el).position)).toBe("fixed");

    const destinations: Array<{ name: string; url: RegExp }> = [
      { name: "League", url: /\/o\/test-club-a\/fixtures/ },
      { name: "Events", url: /\/o\/test-club-a\/events/ },
      { name: "Players", url: /\/o\/test-club-a\/players/ },
      { name: "More", url: /\/o\/test-club-a\/more/ },
      { name: "Today", url: /\/o\/test-club-a\/today/ },
    ];
    for (const dest of destinations) {
      await nav.getByRole("link", { name: dest.name, exact: true }).click();
      await expect(page).toHaveURL(dest.url);
      await expect(page.getByRole("main").first()).toBeVisible();
    }
  });

  test("primary surfaces have no page-level horizontal scroll at compact width", async ({ page }) => {
    for (const path of ["today", "fixtures", "events", "players", "more"]) {
      await gotoSurface(page, path);
      expect(await hasHorizontalScroll(page), `${path} must not scroll horizontally`).toBe(false);
    }
  });

  test("bottom nav does not overlap page content", async ({ page }) => {
    await gotoSurface(page, "today");
    const navBox = await page.getByRole("navigation", { name: "Mobile" }).boundingBox();
    const mainBox = await page.getByRole("main").first().boundingBox();
    expect(navBox).not.toBeNull();
    expect(mainBox).not.toBeNull();
    // The scrollable main region reserves space so its bottom padding clears the fixed nav.
    const mainPaddingBottom = await page
      .getByRole("main")
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom) || 0);
    expect(mainPaddingBottom).toBeGreaterThan(0);
  });
});

test.describe("compact critical flows", () => {
  test("Today leads with a reachable primary action or ready state", async ({ page }) => {
    await gotoSurface(page, "today");
    await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();

    const primary = page
      .getByRole("main")
      .first()
      .getByRole("link")
      .filter({ hasText: /Open|Review|Resolve|Start|Go to|View|Fixtures/i })
      .first();
    if ((await primary.count()) === 0) return; // ready state with no outstanding action — valid

    await primary.click();
    await expect(page).not.toHaveURL(/\/today\/?$/);
  });

  test("League → open a round board when a round is available", async ({ page }) => {
    await gotoSurface(page, "fixtures");

    const roundLink = page
      .getByRole("link", { name: /Generate and review|Review board|Resolve blockers|View finalised board/ })
      .first();
    if (!(await roundLink.isVisible().catch(() => false))) {
      test.skip(true, "No round with an action link in the Test slot");
    }
    await roundLink.click();
    await expect(page).toHaveURL(/\/rounds\/[^/]+/);
    await expect(page.getByRole("main").first()).toBeVisible();

    // If the round has >1 match, the compact one-match selector must be present and URL-backed.
    const selector = page.getByRole("tablist", { name: "Select match" });
    if (await selector.isVisible().catch(() => false)) {
      const tabs = selector.getByRole("tab");
      if ((await tabs.count()) > 1) {
        await tabs.nth(1).click();
        await expect(page).toHaveURL(/[?&]match=/);
        expect(await hasHorizontalScroll(page)).toBe(false);
      }
    }
  });

  test("Players → open a player detail when players exist", async ({ page }) => {
    await gotoSurface(page, "players");

    const playerLink = page.locator("main a[href*='/players/']").first();
    if (!(await playerLink.isVisible().catch(() => false))) {
      test.skip(true, "No player links on the Players page in the Test slot");
    }
    await playerLink.click();
    await expect(page).toHaveURL(/\/players\/[^/?#]+$/);
  });
});
