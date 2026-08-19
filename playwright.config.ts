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
    },
  ],
});
