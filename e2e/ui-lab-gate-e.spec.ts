import { test, expect, type Page } from "@playwright/test";

/**
 * Gate E W1 (register E01, "League — Fixtures and results") and, at the end of this file, Gate E
 * W2 (register E02, "Events — Event day"). E01: real Chromium assertions for
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
 *
 * E01-R6 remediation: "period navigation" and "context restoration" are deliberately split into
 * two separate `describe` blocks below — the former proves default-focus RE-RESOLUTION per
 * period (production clears the `round` param on period switch; it does not remember a manually
 * selected round across periods), the latter proves real URL-backed SELECTED-CONTEXT restoration
 * (direct URL load, browser Back, keyboard operability) — see the first block's own comment.
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

test.describe("E01 — period navigation: default-focus re-resolution (not per-period round memory)", () => {
  // E01-R6: this describe block proves exactly what production actually does — switching period
  // clears the `round` URL param (ADR-0144 "URL as selection authority"; `handleSelectPeriod()`
  // never preserves a round id across a period change) and the destination period's own default
  // focus re-resolves honestly. It does NOT prove, and must never be described as proving, that a
  // manually-selected historical round is remembered when the coach later returns to that same
  // period — production has no such memory, and this wave does not invent one. See
  // INTERACTION_AND_STATE_AUDIT.md's "Context restoration: what this wave proves" section.
  test("switching the league season to Autumn 2026 updates the URL and re-resolves focus to its own Needs-closure round, not Spring's current round", async ({ page }) => {
    await page.goto(`${BASE}/mid-season-current-round`);
    await expect(page.getByText("Current round").first()).toBeVisible();

    await page.getByRole("combobox", { name: "League season" }).selectOption({ label: "Autumn 2026 · Aug – Sep 2026" });
    await page.waitForURL(/season=gate-e-w1-e01-mid-period-autumn-2026/);
    await expect(page.getByText("Needs closure").first()).toBeVisible();
    await expect(page.getByText("Current round")).toHaveCount(0);
  });

  test("switching back to Spring 2027 re-resolves its own current round again, proving focus is re-derived per period rather than cached", async ({ page }) => {
    await page.goto(`${BASE}/mid-season-current-round`);
    await page.getByRole("combobox", { name: "League season" }).selectOption({ label: "Autumn 2026 · Aug – Sep 2026" });
    await page.waitForURL(/season=gate-e-w1-e01-mid-period-autumn-2026/);

    await page.getByRole("combobox", { name: "League season" }).selectOption({ label: "Spring 2027 · Feb – Apr 2027" });
    await page.waitForURL(/season=gate-e-w1-e01-mid-period-spring-2027/);
    await expect(page.getByText("Current round").first()).toBeVisible();
    await expect(page.getByText("Round 9")).toBeVisible();
  });

  test("the URL round param is cleared on period switch — a manually selected round is not carried into an unrelated period", async ({ page }) => {
    await page.goto(`${BASE}/mid-season-current-round`);
    await page.getByRole("button", { name: "W09 — Final" }).click();
    await page.waitForURL(/round=gate-e-w1-e01-mid-round-7/);

    await page.getByRole("combobox", { name: "League season" }).selectOption({ label: "Autumn 2026 · Aug – Sep 2026" });
    await page.waitForURL(/season=gate-e-w1-e01-mid-period-autumn-2026/);
    expect(new URL(page.url()).searchParams.get("round")).toBeNull();
  });
});

test.describe("E01 — selected-context restoration (XR-T01: 'back restores the selected context')", () => {
  test("selecting an earlier round from the season rail updates the URL round param and focuses that round", async ({ page }) => {
    await page.goto(`${BASE}/mid-season-current-round`);
    // The season rail's accessible name is "{weekLabel} — {state}" (`league-season-rail.tsx`),
    // not the round title — Round 7's fixture kickoff falls in week W09, state FINAL (verified
    // directly against the real `buildLeagueOperatingViewModel()` output for this fixture).
    await page.getByRole("button", { name: "W09 — Final" }).click();
    await page.waitForURL(/round=gate-e-w1-e01-mid-round-7/);
    await expect(page.getByText("Final").first()).toBeVisible();
  });

  test("directly loading a URL with a round query param restores that exact round, with no click required", async ({ page }) => {
    await page.goto(`${BASE}/mid-season-current-round?round=gate-e-w1-e01-mid-round-7`);
    await expect(page.getByText("Round 7")).toBeVisible();
    await expect(page.getByText("Final").first()).toBeVisible();
  });

  test("browser Back restores the previously selected round after navigating to a different one", async ({ page }) => {
    await page.goto(`${BASE}/mid-season-current-round`);
    await expect(page.getByText("Round 9")).toBeVisible();

    await page.getByRole("button", { name: "W09 — Final" }).click();
    await page.waitForURL(/round=gate-e-w1-e01-mid-round-7/);
    await expect(page.getByText("Round 7")).toBeVisible();

    await page.goBack();
    await expect(page).not.toHaveURL(/round=gate-e-w1-e01-mid-round-7/);
    await expect(page.getByText("Current round").first()).toBeVisible();
    await expect(page.getByText("Round 9")).toBeVisible();
  });

  test("the season rail is keyboard-operable: ArrowRight moves focus between slots and Enter activates the focused one", async ({ page }) => {
    await page.goto(`${BASE}/mid-season-current-round`);
    const w09 = page.getByRole("button", { name: "W09 — Final" });
    await w09.focus();
    await page.keyboard.press("ArrowRight");
    const w10 = page.getByRole("button", { name: "W10 — Needs closure" });
    await expect(w10).toBeFocused();
    await page.keyboard.press("Enter");
    await page.waitForURL(/round=gate-e-w1-e01-mid-round-8/);
    await expect(page.getByText("Round 8")).toBeVisible();
  });

  test("the season selector is keyboard-operable: focusing it and pressing ArrowDown changes the selected league season", async ({ page }) => {
    await page.goto(`${BASE}/mid-season-current-round`);
    const select = page.getByRole("combobox", { name: "League season" });
    await select.focus();
    await page.keyboard.press("ArrowDown");
    await page.waitForURL(/season=gate-e-w1-e01-mid-period-autumn-2026/, { timeout: 10_000 });
    await expect(page.getByText("Needs closure").first()).toBeVisible();
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
  test("mid-season state's product surface uses production-equivalent desktop width, not an artificially narrow column (E01-R2)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/mid-season-current-round`);
    await expect(page.getByText("Current round").first()).toBeVisible();
    // The real app shell's own content container is `max-w-[96rem]` (src/app/(app)/layout.tsx) —
    // at 1440px viewport width that is effectively uncapped. `.touchline` is the outermost element
    // `LeagueFixtureMount` renders; its real rendered width must be far wider than the previous
    // (incorrect) 720px cap, not merely nonzero.
    const width = await page.locator(".touchline").first().evaluate((el) => el.getBoundingClientRect().width);
    expect(width).toBeGreaterThan(1200);
  });

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

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Gate E W2 (register E02, "Events — Event day") — multi-match event-day progression across
// squads/states with persistent event and match identity (XR-T01, XR-S01, XR-V02). The E01
// tests above are unchanged. Every E02 locator is scoped to a `data-e02-*` attribute or an exact
// accessible name: Playwright's `getByText`/`getByLabel` match substrings tree-wide (the Gate D
// W2/Gate E W1 lesson), and squad/opponent names repeat across rows by design here.
// ─────────────────────────────────────────────────────────────────────────────────────────────
const E02 = "/dev/ui-lab/gate-e/e02-event-day";
const MIXED = `${E02}/mixed-progression`;
const mixedId = (n: string) => `gate-e-w2-e02-${n}`;

async function openE02(page: Page, url: string) {
  await page.goto(url);
  await page.locator('[data-e02-hydrated="true"]').waitFor({ state: "attached", timeout: 30_000 });
}
const e02Row = (page: Page, id: string) => page.locator(`[data-e02-match-row="${id}"]`);
const e02Panel = (page: Page) => page.locator("[data-e02-selected-match]");
const e02Timeline = (page: Page) => page.getByRole("list", { name: "Event-day match timeline" });

test.describe("E02 — event-day progression across squads and states", () => {
  test("upcoming: matches render in kickoff order with both 09:00 matches NEXT and no result anywhere", async ({ page }) => {
    await openE02(page, `${E02}/upcoming`);
    const times = await e02Timeline(page).locator(":scope > li > span:nth-child(2)").allTextContents();
    expect(times.map((t) => t.trim())).toEqual(["09:00", "09:00", "09:40", "10:20", "10:20", "11:20", "12:40", "12:40", "14:00"]);
    await expect(e02Timeline(page).getByText("NEXT", { exact: true })).toHaveCount(2);
    await expect(e02Row(page, "gate-e-w2-e02-m01")).toContainText("Nordbyen FK");
    await expect(e02Timeline(page).getByText(/\bFT\b/)).toHaveCount(0);
  });

  test("completed: recorded results render; Event finalisation is shown separately from the REPORTED-not-locked match", async ({ page }) => {
    await openE02(page, `${E02}/completed`);
    await expect(page.getByText("Event is finalised", { exact: true })).toBeVisible();
    const first = e02Row(page, "gate-e-w2-e02-m01");
    await expect(first).toContainText("Fjellsiden Blå");
    await expect(first).toContainText("3");
    await expect(first).toContainText("FT");
    await expect(e02Row(page, "gate-e-w2-e02-m07")).toContainText("Result reported · report not locked");
    await expect(e02Timeline(page).getByText("NEXT", { exact: true })).toHaveCount(0);
    await expect(e02Timeline(page).getByText("LIVE", { exact: true })).toHaveCount(0);
  });

  test("mixed: cancelled, report-missing, report-draft, live, next and later are each named in text", async ({ page }) => {
    await openE02(page, MIXED);
    for (const kicker of ["CANCELLED", "REPORT MISSING", "REPORT DRAFT", "LATER"]) {
      await expect(e02Timeline(page).getByText(kicker, { exact: true })).toHaveCount(1);
    }
    // "LIVE" is both the timeline kicker and the real ScorebookMatchRow's own live trailer, and
    // only on the one match with an ACTIVE session.
    await expect(e02Timeline(page).getByText("LIVE", { exact: true })).toHaveCount(2);
    await expect(e02Row(page, mixedId("m06")).getByText("LIVE", { exact: true })).toHaveCount(1);
    await expect(e02Timeline(page).getByText("NEXT", { exact: true })).toHaveCount(2);
    await expect(e02Row(page, mixedId("m03"))).toContainText("Sjøvik SK withdrew before kickoff");
    await expect(e02Row(page, mixedId("m05"))).toContainText("Draft report — score not final");
  });

  test("multiple squads stay identifiable: each row names its own squad", async ({ page }) => {
    await openE02(page, MIXED);
    for (const [id, squad] of [["m01", "Fjellsiden Blå"], ["m02", "Fjellsiden Rød"], ["m05", "Fjellsiden Rød"], ["m06", "Fjellsiden Blå"]]) {
      await expect(e02Row(page, mixedId(id))).toContainText(squad);
    }
    await expect(e02Row(page, mixedId("m05"))).not.toContainText("Fjellsiden Blå");
  });
});

test.describe("E02 — event and match identity continuity (XR-S01, XR-V02)", () => {
  test("selecting a Rød match selects exactly that match; the Event heading never changes", async ({ page }) => {
    await openE02(page, MIXED);
    await e02Row(page, mixedId("m05")).getByRole("link").click();
    await page.waitForURL(new RegExp(`match=${mixedId("m05")}`));
    await expect(e02Panel(page)).toHaveAttribute("data-e02-selected-match", mixedId("m05"));
    await expect(e02Panel(page).getByTestId("e02-selected-squad")).toHaveText("Fjellsiden Rød");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Fjellsiden Vårcup");
    await expect(e02Timeline(page).getByText("Selected", { exact: true })).toHaveCount(1);
    await expect(e02Row(page, mixedId("m05")).getByText("Selected", { exact: true })).toBeVisible();
  });

  test("same-opponent matches stay distinct: Nordbyen FK 10:20 (Rød) → 14:00 (Rød) → 09:00 (Blå)", async ({ page }) => {
    await openE02(page, MIXED);
    for (const [id, squad, kickoff] of [["m05", "Fjellsiden Rød", "10:20"], ["m09", "Fjellsiden Rød", "14:00"], ["m01", "Fjellsiden Blå", "09:00"]]) {
      await e02Row(page, mixedId(id)).getByRole("link").click();
      await page.waitForURL(new RegExp(`match=${mixedId(id)}`));
      await expect(e02Panel(page)).toHaveAttribute("data-e02-selected-match", mixedId(id));
      await expect(e02Panel(page).getByTestId("e02-selected-squad")).toHaveText(squad);
      await expect(e02Panel(page).getByTestId("e02-selected-kickoff")).toHaveText(`SAT 13 MAR · ${kickoff}`);
    }
  });

  test("a directly-loaded URL restores the selected match with no click", async ({ page }) => {
    await openE02(page, `${MIXED}?match=${mixedId("m06")}`);
    await expect(e02Panel(page)).toHaveAttribute("data-e02-selected-match", mixedId("m06"));
    await expect(e02Panel(page).getByTestId("e02-selected-state")).toHaveText("Live — reporting session active");
  });

  test("browser Back restores the previous selection, then the unselected Event day", async ({ page }) => {
    await openE02(page, MIXED);
    await e02Row(page, mixedId("m05")).getByRole("link").click();
    await page.waitForURL(new RegExp(`match=${mixedId("m05")}`));
    await e02Row(page, mixedId("m07")).getByRole("link").click();
    await page.waitForURL(new RegExp(`match=${mixedId("m07")}`));
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`match=${mixedId("m05")}`));
    await expect(e02Panel(page)).toHaveAttribute("data-e02-selected-match", mixedId("m05"));
    await page.goBack();
    await expect(page).not.toHaveURL(/match=/);
    await expect(e02Panel(page)).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Fjellsiden Vårcup");
  });

  test("'Back to event day' clears only the selection and returns focus to that match's row", async ({ page }) => {
    await openE02(page, `${MIXED}?theme=dark`);
    await e02Row(page, mixedId("m04")).getByRole("link").click();
    await page.waitForURL(new RegExp(`match=${mixedId("m04")}`));
    await e02Panel(page).getByRole("button", { name: "Back to event day", exact: true }).click();
    await expect(page).not.toHaveURL(/match=/);
    await expect(page).toHaveURL(/theme=dark/);
    await expect(e02Row(page, mixedId("m04")).getByRole("link")).toBeFocused();
  });

  test("a match id belonging to another Event is rejected, never shown under this Event", async ({ page }) => {
    await openE02(page, `${MIXED}?match=gate-e-w2-e02-other-event-m01`);
    await expect(e02Panel(page)).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "belongs to Fjellsiden Vårcup" })).toBeVisible();
  });

  test("switching Event tabs keeps the Event heading, and returning to Overview restores the selection", async ({ page }) => {
    await openE02(page, `${MIXED}?match=${mixedId("m05")}`);
    const tabs = page.getByRole("navigation", { name: "Event sections" });
    await tabs.getByRole("button", { name: "Matches", exact: true }).click();
    await page.waitForURL(/tab=matches/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Fjellsiden Vårcup");
    await tabs.getByRole("button", { name: "Overview", exact: true }).click();
    await expect(page).not.toHaveURL(/tab=/);
    await expect(e02Panel(page)).toHaveAttribute("data-e02-selected-match", mixedId("m05"));
  });

  test("keyboard: Enter on a focused row selects it and moves focus to the selected-match context", async ({ page }) => {
    await openE02(page, MIXED);
    await e02Row(page, mixedId("m07")).getByRole("link").focus();
    await page.keyboard.press("Enter");
    await page.waitForURL(new RegExp(`match=${mixedId("m07")}`));
    await expect(page.getByRole("heading", { name: "Selected match", exact: true })).toBeFocused();
  });

  test("no rendered link targets an invented route; the live entry is the real Event live-reporting route", async ({ page }) => {
    await openE02(page, `${MIXED}?match=${mixedId("m06")}`);
    const hrefs = await page.locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
    const allowed = [
      /^\/dev\/ui-lab\//,
      /^\/events$/,
      /^\/o\/acme\/events\/gate-e-w2-e02-event\/matches\/gate-e-w2-e02-m\d\d\/live(\/follow)?$/,
      /^\/o\/acme\/events\/gate-e-w2-e02-event\?tab=matches$/,
    ];
    for (const href of hrefs) expect(allowed.some((r) => r.test(href)), href).toBe(true);
    const live = e02Panel(page).getByRole("link", { name: "Continue live reporting", exact: true });
    await expect(live).toHaveAttribute("href", `/o/acme/events/gate-e-w2-e02-event/matches/${mixedId("m06")}/live`);
    await live.click();
    await page.waitForURL(/\/signin/, { timeout: 10_000 });
  });

  test("no synthetic interaction sends a real Server Action request (next-action header)", async ({ page }) => {
    const serverActions: string[] = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && req.headers()["next-action"]) serverActions.push(req.url());
    });
    await openE02(page, MIXED);
    await e02Row(page, mixedId("m05")).getByRole("link").click();
    await page.waitForURL(new RegExp(`match=${mixedId("m05")}`));
    await e02Row(page, mixedId("m03")).getByRole("link").click();
    await page.waitForURL(new RegExp(`match=${mixedId("m03")}`));
    const tabs = page.getByRole("navigation", { name: "Event sections" });
    await tabs.getByRole("button", { name: "Squads", exact: true }).click();
    await page.waitForURL(/tab=squads/);
    await tabs.getByRole("button", { name: "Overview", exact: true }).click();
    await expect(page).not.toHaveURL(/tab=/);
    await e02Panel(page).getByRole("button", { name: "Back to event day", exact: true }).click();
    await expect(page).not.toHaveURL(/match=/);
    expect(serverActions).toEqual([]);
  });
});

test.describe("E02 — responsive layout", () => {
  test("desktop: the product surface uses the production-equivalent content width", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openE02(page, MIXED);
    const width = await page.locator("[data-e02-product-surface]").evaluate((el) => el.getBoundingClientRect().width);
    expect(width).toBeGreaterThan(1200);
  });

  for (const state of ["upcoming", "mixed-progression", "completed"]) {
    for (const width of [390, 320]) {
      test(`${state} @ ${width}px has no document-level horizontal overflow`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        await openE02(page, `${E02}/${state}`);
        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        expect(scrollWidth).toBeLessThanOrEqual(innerWidth + 1);
      });
    }
  }

  test("mobile dark: heading, timeline and selection remain usable at 390px", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.setViewportSize({ width: 390, height: 844 });
    await openE02(page, `${MIXED}?theme=dark`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator('.touchline[data-theme="dark"]').first()).toBeAttached();
    await e02Row(page, mixedId("m07")).getByRole("link").click();
    await page.waitForURL(new RegExp(`match=${mixedId("m07")}`));
    await expect(e02Panel(page)).toBeInViewport();
    await expect(e02Panel(page).getByTestId("e02-selected-squad")).toHaveText("Fjellsiden Blå");
  });

  // Independent review M2: below `medium` the shared ScorebookMatchRow ellipsizes team names
  // ("Fjel…"), so each row carries a UI-Lab-only identity line with the full squad and opponent.
  for (const width of [390, 320]) {
    test(`mixed @ ${width}px: every row's full squad and opponent names are visible and not truncated`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await openE02(page, MIXED);
      const lines = page.locator("[data-e02-identity-line]");
      await expect(lines).toHaveCount(9);
      const measured = await lines.evaluateAll((els) =>
        els.map((el) => ({
          text: el.textContent ?? "",
          visible: el.getBoundingClientRect().height > 0,
          fits: el.scrollWidth <= el.clientWidth + 1,
          ellipsis: getComputedStyle(el).textOverflow === "ellipsis",
        })),
      );
      for (const m of measured) {
        expect(m.visible, m.text).toBe(true);
        expect(m.fits, m.text).toBe(true);
        expect(m.ellipsis, m.text).toBe(false);
        expect(m.text).toMatch(/^Fjellsiden (Blå|Rød) v (Nordbyen FK|Kvisten IL|Sjøvik SK|Bakkely IF)$/);
      }
      await expect(e02Row(page, mixedId("m05")).locator("[data-e02-identity-line]")).toHaveText("Fjellsiden Rød v Nordbyen FK");
      await expect(e02Row(page, mixedId("m01")).locator("[data-e02-identity-line]")).toHaveText("Fjellsiden Blå v Nordbyen FK");
    });
  }

  // E02-R4: the identity line is part of the SAME selection target as the row (one link).
  for (const width of [390, 320]) {
    test(`mixed @ ${width}px: row and identity line are one selection target (tap, keyboard, focus, Back)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await openE02(page, MIXED);
      const row = e02Row(page, mixedId("m05"));
      // Exactly one link per match item, containing the identity line, no nested controls.
      await expect(row.locator("a")).toHaveCount(1);
      await expect(row.locator("a [data-e02-identity-line]")).toHaveCount(1);
      await expect(row.locator("a").locator("a, button, input, select, textarea, [tabindex]")).toHaveCount(0);

      // Tap the identity line → selects that match.
      await row.locator("[data-e02-identity-line]").click();
      await page.waitForURL(new RegExp(`match=${mixedId("m05")}`));
      await expect(e02Panel(page)).toHaveAttribute("data-e02-selected-match", mixedId("m05"));
      await expect(page.getByRole("heading", { name: "Selected match", exact: true })).toBeFocused();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Fjellsiden Vårcup");

      // Tap the scorebook part of another row → selects that match.
      await e02Row(page, mixedId("m07")).locator("a > div").first().click();
      await page.waitForURL(new RegExp(`match=${mixedId("m07")}`));
      await expect(e02Panel(page)).toHaveAttribute("data-e02-selected-match", mixedId("m07"));

      // Browser Back restores the prior URL selection.
      await page.goBack();
      await expect(page).toHaveURL(new RegExp(`match=${mixedId("m05")}`));
      await expect(e02Panel(page)).toHaveAttribute("data-e02-selected-match", mixedId("m05"));

      // "Back to event day" clears it and returns focus to that match's single link.
      await e02Panel(page).getByRole("button", { name: "Back to event day", exact: true }).click();
      await expect(page).not.toHaveURL(/match=/);
      await expect(row.locator("a")).toBeFocused();

      // Keyboard activation of the same link.
      await page.keyboard.press("Enter");
      await page.waitForURL(new RegExp(`match=${mixedId("m05")}`));
      await expect(page.getByRole("heading", { name: "Selected match", exact: true })).toBeFocused();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Fjellsiden Vårcup");
    });
  }

  test("desktop: the identity line is not shown (the shared row has room for the names)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openE02(page, MIXED);
    await expect(page.locator("[data-e02-identity-line]").first()).toBeHidden();
  });
});

test.describe("E02 — XR-S01: the same match keeps one identity across scheduled, live and completed", () => {
  const states: [string, string, string | null][] = [
    ["upcoming", "Scheduled", null],
    ["mixed-progression", "Live — reporting session active", "Continue live reporting"],
    ["completed", "Result recorded — report completed", null],
  ];
  for (const [state, stateLabel, liveLabel] of states) {
    test(`${state}: Blå vs Kvisten IL 11:20 (${mixedId("m06")}) keeps squad/opponent/kickoff; state is '${stateLabel}'`, async ({ page }) => {
      await openE02(page, `${E02}/${state}?match=${mixedId("m06")}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Fjellsiden Vårcup");
      await expect(e02Panel(page)).toHaveAttribute("data-e02-selected-match", mixedId("m06"));
      await expect(e02Panel(page).getByTestId("e02-selected-squad")).toHaveText("Fjellsiden Blå");
      await expect(e02Panel(page).getByTestId("e02-selected-kickoff")).toHaveText("SAT 13 MAR · 11:20");
      await expect(e02Panel(page).getByTestId("e02-selected-state")).toHaveText(stateLabel);
      if (liveLabel) await expect(e02Panel(page).getByRole("link", { name: liveLabel, exact: true })).toBeVisible();
      await expect(e02Row(page, mixedId("m06"))).toContainText("Kvisten IL");
    });
  }
});
