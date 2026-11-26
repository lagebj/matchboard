import { test, expect } from "@playwright/test";

/**
 * Gate E W1 (register E01, "League — Fixtures and results") — real Chromium assertions for
 * temporal-orientation identification, period navigation, and context restoration (XR-T01,
 * XR-S02). Runs under the `ui-lab-gate-e` project only (`playwright.config.ts`), against the
 * same local `next dev` server `scripts/ui-lab-visual-review.mjs` already starts in CI
 * (`.github/workflows/ui-lab-visual-review.yml`). No auth, no database — `/dev/ui-lab` is
 * explicitly unauthenticated (`src/app/dev/ui-lab/layout.tsx`).
 *
 * Every link `LeagueFixtureMount` renders — `League teams`, `Review season`, and the real,
 * unmodified view-model's own internal `focusedRound.matches[].href`/`roundBoardHref` (bare
 * unscoped paths, ARR-0035) — ultimately redirects through `/organisations` to
 * `/api/auth/signin` when unauthenticated (verified by reading `resolve-org-slug.ts`,
 * `actor-context.ts`, and `organisations/page.tsx` directly, mirroring the exact precedent and
 * rationale already documented in `ui-lab-gate-c.spec.ts`'s header comment).
 */
const BASE = "/dev/ui-lab/gate-e/e01-league-temporal-orientation";

test.describe("E01 — mid-season: current round identifiable among historical/upcoming", () => {
  test("the current round (Round 9) is labelled 'Current round', distinct from past Final/Needs closure rounds", async ({ page }) => {
    await page.goto(`${BASE}/mid-season-current-round`);
    await expect(page.getByText("Current round").first()).toBeVisible();
    await expect(page.getByText("Round 9")).toBeVisible();
    await expect(page.getByText("Final").first()).toBeVisible();
    await expect(page.getByText("Needs closure").first()).toBeVisible();
  });

  test("the cancelled match in Round 7's history renders as Cancelled with its real reason, never as a result", async ({ page }) => {
    await page.goto(`${BASE}/mid-season-current-round`);
    await expect(page.getByText("Opponent withdrew")).toBeVisible();
  });

  test("the current round's real attention (BLOCKED signal) is visible without replacing its Current-round identity", async ({ page }) => {
    await page.goto(`${BASE}/mid-season-current-round`);
    await expect(page.getByText("Current round").first()).toBeVisible();
    // resolveMatchIssue()/signalIssue() renders the signal's own `currentState` text, not its
    // `title` — "Squad below minimum" is the ruleCode's title, never shown directly.
    await expect(page.getByText("Only 9 available players for this match.")).toBeVisible();
  });

  test("the earlier-rounds disclosure is collapsed by default and reveals Round 6 only on toggle, with no layout shift error", async ({ page }) => {
    await page.goto(`${BASE}/mid-season-current-round`);
    await expect(page.getByText("Round 6")).toHaveCount(0);
    await page.getByRole("button", { name: /earlier rounds/i }).click();
    await expect(page.getByText("Round 6")).toBeVisible();
  });
});

test.describe("E01 — period navigation and context restoration", () => {
  test("switching the league season to Autumn 2026 updates the URL and re-resolves focus to its own Needs-closure round, not Spring's current round", async ({ page }) => {
    await page.goto(`${BASE}/mid-season-current-round`);
    await expect(page.getByText("Current round").first()).toBeVisible();

    await page.getByRole("combobox", { name: "League season" }).selectOption({ label: "Autumn 2026 · Aug – Nov 2026" });
    await page.waitForURL(/season=gate-e-w1-e01-mid-period-autumn-2026/);
    await expect(page.getByText("Needs closure").first()).toBeVisible();
    await expect(page.getByText("Current round")).toHaveCount(0);
  });

  test("switching back to Spring 2027 restores the current-round identity, proving context is re-resolved per period rather than cached", async ({ page }) => {
    await page.goto(`${BASE}/mid-season-current-round`);
    await page.getByRole("combobox", { name: "League season" }).selectOption({ label: "Autumn 2026 · Aug – Nov 2026" });
    await page.waitForURL(/season=gate-e-w1-e01-mid-period-autumn-2026/);

    await page.getByRole("combobox", { name: "League season" }).selectOption({ label: "Spring 2027 · Mar – Jun 2027" });
    await page.waitForURL(/season=gate-e-w1-e01-mid-period-spring-2027/);
    await expect(page.getByText("Current round").first()).toBeVisible();
    await expect(page.getByText("Round 9")).toBeVisible();
  });

  test("selecting an earlier round from the season rail updates the URL round param and focuses that round", async ({ page }) => {
    await page.goto(`${BASE}/mid-season-current-round`);
    // The season rail's accessible name is "{weekLabel} — {state}" (`league-season-rail.tsx`),
    // not the round title — Round 7's fixture kickoff falls in week W09, state FINAL (verified
    // directly against the real `buildLeagueOperatingViewModel()` output for this fixture).
    await page.getByRole("button", { name: "W09 — Final" }).click();
    await page.waitForURL(/round=gate-e-w1-e01-mid-round-7/);
    await expect(page.getByText("Final").first()).toBeVisible();
  });
});

test.describe("E01 — navigation continuity (ARR-0035 bare-path hrefs still resolve to the real auth boundary)", () => {
  test("'Review season' preserves the active league season id and reaches the real auth boundary", async ({ page }) => {
    await page.goto(`${BASE}/mid-season-current-round`);
    const link = page.getByRole("link", { name: /review season/i });
    await expect(link).toHaveAttribute("href", "/o/acme/season?leagueSeasonId=gate-e-w1-e01-mid-period-spring-2027");
    await link.click();
    await page.waitForURL(/\/signin/, { timeout: 10_000 });
  });

  test("'League teams' reaches the real auth boundary", async ({ page }) => {
    await page.goto(`${BASE}/mid-season-current-round`);
    const link = page.getByRole("link", { name: /league teams/i });
    await expect(link).toHaveAttribute("href", "/o/acme/teams");
    await link.click();
    await page.waitForURL(/\/signin/, { timeout: 10_000 });
  });

  test("a focused-round match row's real view-model href reaches the real auth boundary (ARR-0035 residue, not a new defect)", async ({ page }) => {
    await page.goto(`${BASE}/mid-season-current-round`);
    // Round 9's second match (Blåveis IF 2 vs Enebakk IF, tactics not prepared) — the whole row
    // is one link whose target is the action's own target (`?tab=tactics`), not the bare match
    // href, per `league-operational-match-row.tsx`'s own "whole row navigates to the same
    // canonical target its action label promises" rule.
    const link = page.locator("a").filter({ hasText: "Enebakk IF" });
    await expect(link).toHaveAttribute("href", "/matches/gate-e-w1-e01-mid-r9-m2?tab=tactics");
    await link.click();
    await page.waitForURL(/\/signin/, { timeout: 10_000 });
  });
});

test.describe("E01 — season closed: no current round exists (XR-T01 reject case)", () => {
  test("no round is ever labelled 'Current round' when every round is in the past", async ({ page }) => {
    await page.goto(`${BASE}/season-closed-no-current-round`);
    await expect(page.getByText("Round 2")).toBeVisible();
    await expect(page.getByText("Current round")).toHaveCount(0);
    await expect(page.getByText("Needs closure").first()).toBeVisible();
  });

  test("no season selector renders when only one league season exists", async ({ page }) => {
    await page.goto(`${BASE}/season-closed-no-current-round`);
    await expect(page.getByRole("combobox", { name: "League season" })).toHaveCount(0);
  });
});

test.describe("E01 — responsive layout", () => {
  test("mid-season state has no horizontal overflow at mobile width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/mid-season-current-round`);
    await expect(page.getByText("Current round").first()).toBeVisible();
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth + 1);
  });

  test("season-closed state has no horizontal overflow at mobile width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/season-closed-no-current-round`);
    await expect(page.getByText("Round 2")).toBeVisible();
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth + 1);
  });
});
