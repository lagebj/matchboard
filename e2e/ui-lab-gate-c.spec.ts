import { test, expect } from "@playwright/test";

/**
 * Gate C W1 (register C01-C03, "Today Operational Decision Surface") — real Chromium assertions
 * for navigation and responsive layout, mirroring `ui-lab-b08.spec.ts`'s own convention. Runs
 * under the `ui-lab-gate-c` project only (`playwright.config.ts`), against the same local
 * `next dev` server `scripts/ui-lab-visual-review.mjs` already starts in CI
 * (`.github/workflows/ui-lab-visual-review.yml`). No auth, no database — `/dev/ui-lab` is
 * explicitly unauthenticated (`src/app/dev/ui-lab/layout.tsx`).
 *
 * P2-02 remediation (independent review of PR #826): every fixture href now uses the real
 * `/o/{orgSlug}/...` organisation-scoped shape production actually uses (never a bare unscoped
 * path presented as the production destination). P2-02 also distinguishes three separate claims
 * that an href assertion alone cannot make: (1) the href has the correct canonical shape — the
 * plain `toHaveAttribute("href", ...)` checks below; (2) the link was actually clicked — the
 * `.click()` calls below; (3) a real destination was reached in the intended environment — the
 * `waitForURL(/\/signin/)` assertions below, verified empirically (not assumed): every one of
 * these synthetic-id routes is a real, auth-gated production route, and `/dev/ui-lab` carries no
 * session, so Next.js's own real auth middleware redirects to `/signin` through a real
 * `307 -> /signin -> 307 -> /signin?_rsc=...` chain — confirmed directly with request/response
 * logging before writing these assertions. That is the true, intended behavior to prove here,
 * not a workaround — these candidates never fabricate a successful authenticated domain
 * navigation that the synthetic ids could not actually support.
 */

const BASE = "/dev/ui-lab/gate-c";

test.describe("Gate C W1 — C01/C02 navigation", () => {
  test("C01's upcoming-match row has the real canonical org-scoped href and actually navigates to the real auth boundary when clicked", async ({ page }) => {
    await page.goto(`${BASE}/c01-quiet-day`);
    await expect(page.getByText("Nothing needs your attention.")).toBeVisible();
    const link = page.getByRole("link", { name: "Blå vs Nordby IL" });
    await expect(link).toHaveAttribute("href", "/o/acme/matches/match-c01-upcoming-1");
    await link.click();
    await page.waitForURL(/\/signin/, { timeout: 10_000 });
  });

  test("C02's primary decision is the real Jonas identity-collision case, with a real Why disclosure and the real 2-item secondary cap", async ({ page }) => {
    await page.goto(`${BASE}/c02-decision-day`);
    // P2-03: Jonas's problem appears exactly once (promoted to primary), even though the exact
    // same signalKey also exists as a raw plan-integrity signal that could, if the real
    // suppression logic broke, render a second time as a secondary Selection decision.
    await expect(page.getByText("Available and active, but not assigned to any match in Round 9.")).toHaveCount(1);
    await expect(page.getByText("CURRENT SITUATION").first()).toBeVisible();
    await expect(page.getByText("No core-team match currently needs additional players this round.")).toBeVisible();
    await expect(page.getByText("Available and active, but not assigned to any match in Round 7.")).toBeVisible();
    await expect(page.getByText("Theodor is planned twice in Round 10")).toBeVisible();
    await expect(page.getByText("Round 11 squads not yet opened")).toHaveCount(0);
  });

  test("C02's Round Board link has the real canonical org-scoped href and actually navigates to the real auth boundary when clicked", async ({ page }) => {
    await page.goto(`${BASE}/c02-decision-day`);
    const link = page.getByRole("link", { name: "Review in Round Board" }).first();
    await expect(link).toHaveAttribute("href", "/o/acme/rounds/round-c02-1");
    await link.click();
    await page.waitForURL(/\/signin/, { timeout: 10_000 });
  });
});

test.describe("Gate C W1 — P1-04/P1-05: information preserved, not duplicated or dropped", () => {
  test("C01 (desktop): all three carry-forward items remain reachable, each exactly once — none duplicated, none dropped", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/c01-quiet-day`);
    await expect(page.getByText("Report still open — Blå 3-1 Åsgård")).toHaveCount(1);
    await expect(page.getByText("Noah's development review is ready to revisit")).toHaveCount(1);
    await expect(page.getByText("Team focus review is ready to revisit")).toHaveCount(1);
  });

  test("C01 (mobile): all three carry-forward items remain reachable in the stacked reading order, each exactly once", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/c01-quiet-day`);
    await expect(page.getByText("Report still open — Blå 3-1 Åsgård")).toHaveCount(1);
    await expect(page.getByText("Noah's development review is ready to revisit")).toHaveCount(1);
    await expect(page.getByText("Team focus review is ready to revisit")).toHaveCount(1);
  });

  test("C03 League · Prepare (desktop): organisation-wide availability and Matchday's own match-specific readiness are both visible, with distinct numbers and a scope label", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/c03-matchday-prelive/league/prepare`);
    await expect(page.getByText("8 of 11 planned")).toBeVisible();
    await expect(page.getByText("All active players")).toBeVisible();
    await expect(page.getByText("Available").first()).toBeVisible();
    await expect(page.getByText("28")).toBeVisible();
  });

  test("C03 League · Prepare (mobile): organisation-wide availability remains reachable alongside Matchday's own readiness in the stacked reading order", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/c03-matchday-prelive/league/prepare`);
    await expect(page.getByText("8 of 11 planned")).toBeVisible();
    await expect(page.getByText("All active players")).toBeVisible();
    await expect(page.getByText("28")).toBeVisible();
  });
});

test.describe("Gate C W1 — C03 matchday readiness links preserve League/Event context", () => {
  test("League · Prepare's primary action has the real League org-scoped href and reaches the real auth boundary when clicked", async ({ page }) => {
    await page.goto(`${BASE}/c03-matchday-prelive/league/prepare`);
    await expect(page.getByText("vs Stoppen Juventus")).toBeVisible();
    const action = page.getByRole("link", { name: "Prepare lineup" });
    await expect(action).toHaveAttribute("href", "/o/acme/matches/match-c03-featured");
    await action.click();
    await page.waitForURL(/\/signin/, { timeout: 10_000 });
  });

  test("League · Prepare demonstrates a genuinely busy same-day chronology without the contradictory quiet-day message", async ({ page }) => {
    await page.goto(`${BASE}/c03-matchday-prelive/league/prepare`);
    await expect(page.getByText("Nothing needs your attention.")).toHaveCount(0);
    await expect(page.getByText("Today in order")).toBeVisible();
    await expect(page.getByText(/Åsgård/)).toBeVisible();
    await expect(page.getByText(/Fagerstrand/)).toBeVisible();
    await expect(page.getByText(/Stoppen Juventus/)).toHaveCount(1);
  });

  test("League · Imminent's primary action has the real League live-entry org-scoped href", async ({ page }) => {
    await page.goto(`${BASE}/c03-matchday-prelive/league/imminent`);
    await expect(page.getByRole("link", { name: "Start live reporting" })).toHaveAttribute(
      "href",
      "/o/acme/matches/match-c03-featured/live",
    );
  });

  test("Event · Prepare's primary action has the real Event org-scoped href, not a League one, and reaches the real auth boundary when clicked", async ({ page }) => {
    await page.goto(`${BASE}/c03-matchday-prelive/event/prepare`);
    await expect(page.getByText("vs Nordby IL")).toBeVisible();
    const action = page.getByRole("link", { name: "Prepare lineup" });
    await expect(action).toHaveAttribute("href", "/o/acme/events/event-c03-1");
    await action.click();
    await page.waitForURL(/\/signin/, { timeout: 10_000 });
  });

  test("Event · Prepare keeps the same-day League chronology distinct from the Event match", async ({ page }) => {
    await page.goto(`${BASE}/c03-matchday-prelive/event/prepare`);
    await expect(page.getByText("Today in order")).toBeVisible();
    await expect(page.getByText(/Åsgård/)).toBeVisible();
    await expect(page.getByText(/Fagerstrand/)).toBeVisible();
    await expect(page.getByText(/Nordby IL/)).toHaveCount(1);
  });

  test("Event · Imminent's primary action has the real Event-scoped live-entry org-scoped href", async ({ page }) => {
    await page.goto(`${BASE}/c03-matchday-prelive/event/imminent`);
    await expect(page.getByRole("link", { name: "Start live reporting" })).toHaveAttribute(
      "href",
      "/o/acme/events/event-c03-1/matches/event-match-c03-featured/live",
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
