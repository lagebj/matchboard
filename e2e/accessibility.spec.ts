import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Standard-library accessibility scanning only — no custom a11y tooling (see ADR-0069 and the
// consolidation programme's explicit guidance against building custom accessibility-scanning
// infrastructure). Scoped to WCAG 2.1 A/AA, the same baseline @axe-core/playwright defaults to.

test.describe("accessibility", () => {
  test("Today page has no automatically detectable violations", async ({ page }) => {
    await page.goto("/o/test-club-a/today");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations, JSON.stringify(results.violations, null, 2)).toHaveLength(0);
  });

  test("League page has no automatically detectable violations", async ({ page }) => {
    await page.goto("/o/test-club-a/fixtures");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations, JSON.stringify(results.violations, null, 2)).toHaveLength(0);
  });
});
