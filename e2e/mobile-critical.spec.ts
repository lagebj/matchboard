import { test, expect } from "@playwright/test";

/**
 * Bounded compact-viewport critical-flow suite (ADR-0124 §8, TEST_AND_ACCEPTANCE.md).
 *
 * Runs under two projects only — `mobile-critical-chromium` (390×844) and
 * `mobile-critical-webkit` (iPhone-like compact viewport, WebKit engine). It does NOT
 * re-run the heavy mutation/business-logic specs across viewports; it checks the adaptive
 * shell and the compact navigation/layout contract that the desktop suites can't see.
 *
 * Deliberately navigation/layout focused and defensive (skips data-dependent assertions
 * when the shared Test slot doesn't have the precondition) so it stays low-flake against
 * the one shared environment.
 */

const ORG = "test-club-a";

async function hasHorizontalScroll(page: import("@playwright/test").Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
}

test.describe("compact shell", () => {
  test("bottom navigation is fixed, shows the five primary destinations, and each navigates", async ({
    page,
  }) => {
    await page.goto(`/o/${ORG}/today`);

    const nav = page.getByRole("navigation", { name: "Mobile" });
    await expect(nav).toBeVisible();

    // Fixed to the bottom of the viewport, not scrolled away with content.
    const position = await nav.evaluate((el) => getComputedStyle(el).position);
    expect(position).toBe("fixed");

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
    }
  });

  test("primary surfaces have no page-level horizontal scroll at compact width", async ({ page }) => {
    for (const path of ["today", "fixtures", "events", "players", "more"]) {
      await page.goto(`/o/${ORG}/${path}`);
      await page.waitForLoadState("networkidle");
      expect(await hasHorizontalScroll(page), `${path} must not scroll horizontally`).toBe(false);
    }
  });
});

test.describe("compact critical flows", () => {
  test("Today → open the next action / primary work surface", async ({ page }) => {
    await page.goto(`/o/${ORG}/today`);
    await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();

    // The hero is either a "Next action" / "Worth reviewing" card or a ready-state empty card.
    // Both offer a primary link into the workflow — follow it and confirm we leave Today.
    const primary = page
      .getByRole("main")
      .getByRole("link")
      .filter({ hasText: /Open|Review|Go to|Resolve|Start|View|Fixtures|round|report/i })
      .first();

    if (await primary.count()) {
      await primary.click();
      await expect(page).not.toHaveURL(/\/today$/);
    }
  });

  test("League → open a round board", async ({ page }) => {
    await page.goto(`/o/${ORG}/fixtures`);
    await page.waitForLoadState("networkidle");

    const roundLink = page.getByRole("link", { name: /Generate and review|Review board|Resolve blockers|View finalised board/ }).first();
    test.skip((await roundLink.count()) === 0, "No round with an action link in the Test slot");

    await roundLink.click();
    await expect(page).toHaveURL(/\/rounds\//);
  });

  test("compact Round Board shows one match with a URL-backed selector when multiple matches exist", async ({
    page,
  }) => {
    await page.goto(`/o/${ORG}/fixtures`);
    await page.waitForLoadState("networkidle");
    const roundLink = page.getByRole("link", { name: /Generate and review|Review board|Resolve blockers|View finalised board/ }).first();
    test.skip((await roundLink.count()) === 0, "No round available in the Test slot");
    await roundLink.click();
    await expect(page).toHaveURL(/\/rounds\//);

    const selector = page.getByRole("tablist", { name: "Select match" });
    test.skip((await selector.count()) === 0, "Round has 0–1 matches; no compact match selector");

    const tabs = selector.getByRole("tab");
    const count = await tabs.count();
    expect(count).toBeGreaterThan(1);

    await tabs.nth(1).click();
    await expect(page).toHaveURL(/[?&]match=/);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test("Players → open a player detail", async ({ page }) => {
    await page.goto(`/o/${ORG}/players`);
    await page.waitForLoadState("networkidle");

    const playerLink = page.getByRole("main").getByRole("link", { name: /\w/ }).filter({ hasNotText: /^(Season|Current|Manage|Add player)/ }).first();
    test.skip((await playerLink.count()) === 0, "No players in the Test slot");

    await playerLink.click();
    await expect(page).toHaveURL(/\/players\/[^/]+$/);
  });
});
