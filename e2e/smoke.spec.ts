import { test, expect } from "@playwright/test";

// Layer 2 smoke coverage (ADR-0069). Deliberately narrow: unauthenticated redirect, authenticated
// landing, one core navigation, no console errors. Broader coverage (mutations, persistence,
// expected-authz-failure specs) is tracked as follow-up in
// docs/development/browser-acceptance-testing.md, not silently missing.

test.describe("unauthenticated access", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("redirects to /signin", async ({ page }) => {
    await page.goto("/o/test-club-a/assistant");
    await expect(page).toHaveURL(/\/signin/);
  });
});

// Matchboard currently serves CSP as Content-Security-Policy-Report-Only (not enforced) — Chrome
// logs this specific advisory whenever a report-only policy includes upgrade-insecure-requests,
// which has no effect in report-only mode. Expected, not a real error.
const KNOWN_BENIGN_CONSOLE_MESSAGES = [
  "The Content Security Policy directive 'upgrade-insecure-requests' is ignored when delivered in a report-only policy.",
];

test.describe("authenticated as coach-all-a", () => {
  test("landing page resolves to the Assistant page for Org A", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && !KNOWN_BENIGN_CONSOLE_MESSAGES.includes(msg.text())) {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/");
    await expect(page).toHaveURL(/\/o\/test-club-a\/assistant/);

    expect(consoleErrors, `Unexpected console errors: ${consoleErrors.join("; ")}`).toHaveLength(0);
  });

  test("can navigate to Fixtures", async ({ page }) => {
    await page.goto("/o/test-club-a/assistant");

    await page.getByRole("link", { name: "Fixtures" }).click();
    await expect(page).toHaveURL(/\/o\/test-club-a\/fixtures/);
  });
});
