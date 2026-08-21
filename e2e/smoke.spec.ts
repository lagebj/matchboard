import { test, expect } from "@playwright/test";

// Layer 2 smoke coverage (ADR-0069). Deliberately narrow: unauthenticated redirect, authenticated
// landing, one core navigation, no console errors. Broader coverage (mutations, persistence,
// expected-authz-failure specs) is tracked as follow-up in
// docs/development/browser-acceptance-testing.md, not silently missing.

test.describe("unauthenticated access", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("redirects to /signin", async ({ page }) => {
    await page.goto("/o/test-club-a/today");
    await expect(page).toHaveURL(/\/signin/);
  });
});

// Matchboard currently serves CSP as Content-Security-Policy-Report-Only (not enforced) — Chrome
// logs this specific advisory whenever a report-only policy includes upgrade-insecure-requests,
// which has no effect in report-only mode. Expected, not a real error. Stops appearing once
// CSP_ENFORCE=true is set (Phase 12 §77) — remove this entry once that's confirmed everywhere
// this suite runs against.
//
// The previous entry here for Vercel's vercel.live toolbar framing violation is gone: csp.ts now
// sets an explicit frame-src allowing https://vercel.live, so that violation no longer occurs in
// either report-only or enforced mode.
const KNOWN_BENIGN_CONSOLE_MESSAGES = [
  "The Content Security Policy directive 'upgrade-insecure-requests' is ignored when delivered in a report-only policy.",
];

test.describe("authenticated as coach-all-a", () => {
  test("landing page resolves to the Today page for Org A", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      // Chrome appends a trailing newline to some console.error messages (confirmed: the
      // vercel.live CSP-violation advisory below) — trim before comparing so the allowlist
      // matches on content, not incidental whitespace.
      if (msg.type() === "error" && !KNOWN_BENIGN_CONSOLE_MESSAGES.includes(msg.text().trim())) {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/");
    await expect(page).toHaveURL(/\/o\/test-club-a\/today/);

    expect(consoleErrors, `Unexpected console errors: ${consoleErrors.join("; ")}`).toHaveLength(0);
  });

  test("can navigate to League", async ({ page }) => {
    await page.goto("/o/test-club-a/today");

    // exact: true -- the sidebar's "League" nav link and any future page content that happens to
    // contain the substring "League" both satisfy a loose match. This test is specifically about
    // primary navigation, not page content.
    await page.getByRole("link", { name: "League", exact: true }).click();
    await expect(page).toHaveURL(/\/o\/test-club-a\/fixtures/);
  });
});
