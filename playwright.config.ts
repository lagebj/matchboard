import { defineConfig, devices } from "@playwright/test";

const DEFAULT_BASE_URL = "https://test.matchboard.football";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? DEFAULT_BASE_URL;

if (baseURL.includes("app.matchboard.football")) {
  throw new Error(
    "playwright.config.ts: baseURL must never point at production (app.matchboard.football). " +
      "Layer 2 browser acceptance testing runs against the Test slot or a local dev server only.",
  );
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/coach.json",
      },
      dependencies: ["setup"],
      // authz-failure.spec.ts asserts what a restricted VIEWER-role persona is denied — running
      // it under the full-access coach persona would make its "denied" assertions false. It runs
      // only under the "chromium-viewer" project below (ADR-0078).
      testIgnore: /authz-failure\.spec\.ts/,
    },
    {
      name: "chromium-viewer",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/viewer.json",
      },
      dependencies: ["setup"],
      testMatch: /authz-failure\.spec\.ts/,
    },
    // Phone/tablet viewport matrix (Phase 2.18) — scoped to accessibility.spec.ts only, not
    // every spec: the point is catching responsive/adaptive-layout a11y issues at real device
    // sizes, not redundantly re-running mutation/business-logic specs across viewports for no
    // accessibility benefit.
    //
    // Deliberately built from Desktop Chrome + a manual viewport/touch override rather than
    // devices["iPhone 13"]/["iPad Mini"] — those presets default to WebKit, a browser engine
    // this repo's CI never installs (only `npx playwright install --with-deps chromium` — see
    // docs/development/browser-acceptance-testing.md). What actually matters for this matrix is
    // viewport size + touch/mobile flags, not literally using Safari's engine, and this keeps
    // every project on the one browser engine CI already has.
    {
      name: "accessibility-phone",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        storageState: "e2e/.auth/coach.json",
      },
      dependencies: ["setup"],
      testMatch: /accessibility\.spec\.ts/,
    },
    {
      name: "accessibility-tablet",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 768, height: 1024 },
        isMobile: true,
        hasTouch: true,
        storageState: "e2e/.auth/coach.json",
      },
      dependencies: ["setup"],
      testMatch: /accessibility\.spec\.ts/,
    },
  ],
});
