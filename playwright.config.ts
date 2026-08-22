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
    {
      name: "accessibility-phone",
      use: {
        ...devices["iPhone 13"],
        storageState: "e2e/.auth/coach.json",
      },
      dependencies: ["setup"],
      testMatch: /accessibility\.spec\.ts/,
    },
    {
      name: "accessibility-tablet",
      use: {
        ...devices["iPad Mini"],
        storageState: "e2e/.auth/coach.json",
      },
      dependencies: ["setup"],
      testMatch: /accessibility\.spec\.ts/,
    },
  ],
});
