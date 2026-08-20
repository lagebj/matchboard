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
//
// Vercel injects its own "Live Feedback" toolbar (vercel.live) into Preview deployments only —
// never Production — for team members viewing them. That toolbar's own iframe/script triggers
// this report-only frame-src violation; it's Vercel's infrastructure, not app behavior, and only
// ever appears when this suite targets a Preview deployment (docs/adr/0075, the per-PR
// acceptance pipeline), never against the persistent Test slot's Production-target deployment.
const KNOWN_BENIGN_CONSOLE_MESSAGES = [
  "The Content Security Policy directive 'upgrade-insecure-requests' is ignored when delivered in a report-only policy.",
  "Framing 'https://vercel.live/' violates the following report-only Content Security Policy directive: \"default-src 'self'\". The violation has been logged, but no further action has been taken. Note that 'frame-src' was not explicitly set, so 'default-src' is used as a fallback.",
];

test.describe("authenticated as coach-all-a", () => {
  test("landing page resolves to the Assistant page for Org A", async ({ page }) => {
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
    await expect(page).toHaveURL(/\/o\/test-club-a\/assistant/);

    expect(consoleErrors, `Unexpected console errors: ${consoleErrors.join("; ")}`).toHaveLength(0);
  });

  test("can navigate to Fixtures", async ({ page }) => {
    await page.goto("/o/test-club-a/assistant");

    await page.getByRole("link", { name: "Fixtures" }).click();
    await expect(page).toHaveURL(/\/o\/test-club-a\/fixtures/);
  });
});
