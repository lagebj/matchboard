import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Standard-library accessibility scanning only — no custom a11y tooling (see ADR-0069 and the
// consolidation programme's explicit guidance against building custom accessibility-scanning
// infrastructure). Now scoped to WCAG 2.2 AA (was 2.1 — the 2.1 tags remain included since 2.2
// is a superset of 2.1's success criteria).
//
// Runs across three Playwright projects (see playwright.config.ts): default desktop, plus
// "accessibility-phone" (390x844) and "accessibility-tablet" (768x1024) — this file is the
// entire phone/tablet viewport matrix for now (Phase 2.18), not yet extended to every e2e spec.

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.describe("accessibility", () => {
  test("Today page has no automatically detectable violations", async ({ page }) => {
    await page.goto("/o/test-club-a/today");

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

    expect(results.violations, JSON.stringify(results.violations, null, 2)).toHaveLength(0);
  });

  test("League page has no automatically detectable violations", async ({ page }) => {
    await page.goto("/o/test-club-a/fixtures");

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

    expect(results.violations, JSON.stringify(results.violations, null, 2)).toHaveLength(0);
  });

  test("Players page has no automatically detectable violations", async ({ page }) => {
    await page.goto("/o/test-club-a/players");

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

    expect(results.violations, JSON.stringify(results.violations, null, 2)).toHaveLength(0);
  });

  test("Opponents page has no automatically detectable violations", async ({ page }) => {
    await page.goto("/o/test-club-a/opponents");

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

    expect(results.violations, JSON.stringify(results.violations, null, 2)).toHaveLength(0);
  });

  test("Round Board has no automatically detectable violations", async ({ page }) => {
    // Round Board needs a real round ID — navigate via the rounds list like
    // round-mutation.spec.ts does, rather than hardcoding an ID from the seed dataset.
    // Scoped to <main> (not page.getByRole("link").first()) — the sidebar/top-bar render
    // their own links before the page content in the DOM, so an unscoped "first link" query
    // clicks a nav link (e.g. Today) instead of a round card, as a live CI run confirmed.
    await page.goto("/o/test-club-a/rounds");
    await page.locator("main").getByRole("link").first().click();
    await expect(page).toHaveURL(/\/o\/test-club-a\/rounds\//);

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

    expect(results.violations, JSON.stringify(results.violations, null, 2)).toHaveLength(0);
  });
});
