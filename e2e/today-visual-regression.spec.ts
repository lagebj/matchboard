import { test, expect } from "@playwright/test";

// Today corrective convergence visual regression (ADR-0142, 06_VISUAL_VERIFICATION_GATE.md).
// The deterministic UI Lab "primary (golden)" fixture is the one place this composition can be
// screenshotted without depending on live seed-dataset state — same rationale as the other
// pure-fixture UI Lab routes this repo already treats as safe to keep stable.
//
// The baseline PNG committed alongside this spec was captured from the *first human-approved*
// implementation screenshot (06_VISUAL_VERIFICATION_GATE.md "Automated regression after human
// approval") — it is a pixel baseline for catching future regressions in this composition, not a
// re-assertion of the conceptual golden mock. Do not regenerate it against the conceptual golden.
//
// `/dev/ui-lab/**` 404s in production (src/app/dev/ui-lab/layout.tsx) — this spec only has value,
// and only runs, against non-production targets (local dev / the Test slot).
test.skip(
  process.env.PLAYWRIGHT_BASE_URL?.includes("app.matchboard.football") ?? false,
  "/dev/ui-lab/** is production-only notFound() — this spec never targets production.",
);

test("Today UI Lab primary state matches the approved implementation baseline", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.goto("/dev/ui-lab/atlas/routes/today?state=primary", { waitUntil: "networkidle" });

  await expect(page).toHaveScreenshot("today-primary.png", {
    maxDiffPixelRatio: 0.02,
  });
});
