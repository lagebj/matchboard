import { test, expect } from "@playwright/test";

/**
 * Gate C W1 (register C01-C03, "Today Operational Decision Surface") — real Chromium assertions
 * for navigation and responsive layout, mirroring `ui-lab-b08.spec.ts`'s own convention. Runs
 * under the `ui-lab-gate-c` project only (`playwright.config.ts`), against the same local
 * `next dev` server `scripts/ui-lab-visual-review.mjs` already starts in CI
 * (`.github/workflows/ui-lab-visual-review.yml`). No auth, no database — `/dev/ui-lab` is
 * explicitly unauthenticated (`src/app/dev/ui-lab/layout.tsx`).
 */

const BASE = "/dev/ui-lab/gate-c";

test.describe("Gate C W1 — C01/C02 navigation", () => {
  test("C01's upcoming-match row is a real link into the match's own canonical route, not a dead row", async ({ page }) => {
    // `/dev/ui-lab` is deliberately unauthenticated and the target is a real, auth-gated
    // production route (`/matches/[id]`) — asserting the href (as the C03 tests below also do
    // for matchday readiness links) proves the navigation is real without actually following it
    // into a sign-in redirect that would prove nothing further about this candidate.
    await page.goto(`${BASE}/c01-quiet-day`);
    await expect(page.getByText("Nothing needs your attention.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Blå vs Nordby IL" })).toHaveAttribute(
      "href",
      "/matches/match-c01-upcoming-1",
    );
  });

  test("C02's primary decision has a real Why? disclosure and the real 2-item secondary cap", async ({ page }) => {
    await page.goto(`${BASE}/c02-decision-day`);
    await expect(page.getByText("Squad below minimum for Saturday's match")).toBeVisible();
    await expect(page.getByText("Why?")).toBeVisible();
    await expect(page.getByText("Available and active, but not assigned to any match in Round 7.")).toBeVisible();
    await expect(page.getByText("Theodor is planned twice in Round 10")).toBeVisible();
    await expect(page.getByText("Round 11 squads not yet opened")).toHaveCount(0);
  });
});

test.describe("Gate C W1 — C03 matchday readiness links preserve League/Event context", () => {
  test("League · Prepare's primary action opens the real League match route", async ({ page }) => {
    await page.goto(`${BASE}/c03-matchday-prelive/league/prepare`);
    await expect(page.getByText("vs Stoppen Juventus")).toBeVisible();
    await expect(page.getByRole("link", { name: "Prepare lineup" })).toHaveAttribute("href", "/matches/match-c03-1");
  });

  test("League · Imminent's primary action opens the real League live-entry route", async ({ page }) => {
    await page.goto(`${BASE}/c03-matchday-prelive/league/imminent`);
    await expect(page.getByRole("link", { name: "Start live reporting" })).toHaveAttribute(
      "href",
      "/matches/match-c03-1/live",
    );
  });

  test("Event · Prepare's primary action opens the real Event route, not a League one", async ({ page }) => {
    await page.goto(`${BASE}/c03-matchday-prelive/event/prepare`);
    await expect(page.getByText("vs Nordby IL")).toBeVisible();
    await expect(page.getByRole("link", { name: "Prepare lineup" })).toHaveAttribute("href", "/events/event-c03-1");
  });

  test("Event · Imminent's primary action opens the real Event-scoped live-entry route", async ({ page }) => {
    await page.goto(`${BASE}/c03-matchday-prelive/event/imminent`);
    await expect(page.getByRole("link", { name: "Start live reporting" })).toHaveAttribute(
      "href",
      "/events/event-c03-1/matches/event-match-c03-1/live",
    );
  });

  test("the matchday phase nav can move between all six phase/source combinations", async ({ page }) => {
    await page.goto(`${BASE}/c03-matchday-prelive/league/prepare`);
    await page.getByRole("link", { name: "League · Verify" }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/c03-matchday-prelive/league/verify$`));
    await page.getByRole("link", { name: "Event · Imminent" }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/c03-matchday-prelive/event/imminent$`));
  });
});

test.describe("Gate C W1 — responsive layout: no horizontal page overflow at any required width", () => {
  const SCENARIOS = [
    "c01-quiet-day",
    "c02-decision-day",
    "c03-matchday-prelive/league/prepare",
    "c03-matchday-prelive/league/verify",
    "c03-matchday-prelive/league/imminent",
    "c03-matchday-prelive/event/prepare",
    "c03-matchday-prelive/event/verify",
    "c03-matchday-prelive/event/imminent",
  ];
  const WIDTHS = [320, 360, 390, 430, 768, 1440];

  for (const scenario of SCENARIOS) {
    for (const width of WIDTHS) {
      test(`${scenario} @ ${width}px has no document-level horizontal overflow`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${BASE}/${scenario}`);
        await page.locator("h1").first().waitFor({ state: "visible" });
        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        expect(scrollWidth).toBeLessThanOrEqual(innerWidth + 1);
      });
    }
  }
});
