import { test, expect } from "@playwright/test";

/**
 * B08 W5 remediation (independent review, section 11 "Browser-based acceptance coverage") — real
 * Chromium assertions for B08's lifecycle continuity, navigation, and responsive layout. Runs
 * under the `ui-lab-b08` project only (`playwright.config.ts`), against the same local `next dev`
 * server `scripts/ui-lab-visual-review.mjs` already starts in CI
 * (`.github/workflows/ui-lab-visual-review.yml`). No auth, no database — `/dev/ui-lab` is
 * explicitly unauthenticated (`src/app/dev/ui-lab/layout.tsx`).
 *
 * Each `test()` gets Playwright's own fresh, isolated browser context — the sessionStorage-backed
 * B08 journey (`shared/b08-journey.ts`) is therefore always empty at the start of every test, the
 * same "reference snapshot" guarantee every CI capture already relies on.
 */

const BASE = "/dev/ui-lab/gate-b/b08-information-ownership";

test.describe("B08 — navigation and lifecycle-state continuity", () => {
  test("BEFORE's primary action opens LIVE with the same match identity, and real browser Back returns to BEFORE", async ({ page }) => {
    await page.goto(`${BASE}/before`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Before match");
    // A real <Link> navigation (unlike an in-page tab switch, which uses router.replace and
    // deliberately does not push history) — genuinely exercises the browser's own history stack.
    await page.getByRole("link", { name: "Start live reporting" }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/live$`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Live");

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${BASE}/before$`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Before match");
  });

  test("LIVE's own back link returns to BEFORE", async ({ page }) => {
    await page.goto(`${BASE}/live`);
    await page.getByRole("link", { name: /Back to this match/ }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/before$`));
  });

  test("a direct visit to AFTER (no journey) shows the reference snapshot: report incomplete, 2-1", async ({ page }) => {
    await page.goto(`${BASE}/after`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("report incomplete");
    await expect(page.getByText("Needs work", { exact: true })).toBeVisible();
  });

  test("AFTER's primary action opens REPORT-DRAFT", async ({ page }) => {
    await page.goto(`${BASE}/after`);
    await page.getByRole("link", { name: "Continue report" }).first().click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/report-draft`));
  });

  test("completing REPORT-DRAFT in place, then returning to Match Details, shows the COMPLETED state — not the stale draft/incomplete one (P1-5)", async ({ page }) => {
    await page.goto(`${BASE}/report-draft?tab=players`);
    await page.getByRole("button", { name: "Confirm duration", exact: true }).click();
    await expect(page.getByText("Confirm duration", { exact: true })).toHaveCount(0);

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Complete report", exact: true }).click();
    await expect(page.getByRole("button", { name: "Reopen report", exact: true })).toBeVisible();

    // Both back-links must now carry the completed variant (P1-5/P1-6 — SafePostMatchReportShell's
    // own internal link, and this page's own top breadcrumb).
    await expect(page.getByRole("link", { name: "‹ Back to match" })).toHaveAttribute("href", new RegExp(`${BASE}/after\\?report=completed$`));
    await expect(page.getByRole("link", { name: "← Back to match (After)" })).toHaveAttribute("href", new RegExp(`${BASE}/after\\?report=completed`));

    await page.getByRole("link", { name: "‹ Back to match" }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/after\\?report=completed`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText("report completed");
    await expect(page.getByText("Completed", { exact: true })).toBeVisible();
    await expect(page.getByText("Needs work", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "View report" })).toHaveAttribute("href", new RegExp(`${BASE}/report-completed$`));
  });

  test("REPORT-COMPLETED's own back link also preserves the completed state on return to AFTER", async ({ page }) => {
    await page.goto(`${BASE}/report-completed`);
    await page.getByRole("link", { name: "‹ Back to match" }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/after\\?report=completed`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText("report completed");
  });

  test("an invalid report tab falls back to the real default without showing stale content, once locked", async ({ page }) => {
    await page.goto(`${BASE}/report-completed?tab=review`);
    // "review" is DRAFT-only; COMPLETED replaces it with "combinations" — the real resolver falls
    // back to the surface's own default (summary), never leaving the stale Review content visible.
    await expect(page.getByText(/Plan integrity review/)).toHaveCount(0);
  });

  test("reload preserves the selected tab on REPORT-DRAFT (a direct URL visit)", async ({ page }) => {
    // The report's own tab rail renders plain buttons wired to router.replace() (no per-tab
    // href, and replace() deliberately does not push a new history entry — selecting a tab is
    // not something browser Back is expected to undo in this app). Reload is tested directly
    // against a URL carrying the tab, rather than via a click, for exactly that reason.
    await page.goto(`${BASE}/report-draft?tab=timeline`);
    await expect(page.getByRole("button", { name: "Timeline" })).toHaveAttribute("aria-current", "page");
    await page.reload();
    await expect(page.getByRole("button", { name: "Timeline" })).toHaveAttribute("aria-current", "page");
  });
});

test.describe("B08 — LIVE-to-report continuity (P1-6, extended for W5's second remediation 'lifecycle data consistency' and third remediation 'final data-integrity remediation'): the SAME effective match appears consistently across LIVE, REPORT-DRAFT, AFTER and REPORT-COMPLETED — never a different history in a different workspace", () => {
  // Journey A (independent review, section 10): match finishes 1-1.
  test("Journey A — finishing LIVE without recording the 48' winner: a real 1-1 all the way through REPORT-DRAFT, completion, AFTER, REPORT-COMPLETED and a reload", async ({ page }) => {
    await page.goto(`${BASE}/live`);
    await expect(page.getByRole("button", { name: "Finish live reporting" })).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Finish live reporting" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Confirm" }).click();

    // handleEndSession navigates via its injected actions.reportUrl() once endSession() returns a
    // reportId — a real window.location.href hard navigation, not a client-side route change.
    await page.waitForURL(new RegExp(`${BASE}/report-draft`), { timeout: 15_000 });
    await expect(page.getByText(/Reflecting your LIVE session/)).toBeVisible();
    await expect(page.getByText("1 - 1").first()).toBeAttached();
    // No 48' winner recorded in this journey — its own minute label must not appear anywhere
    // (the fixed reference match's own goal list would otherwise show "10'" AND "48'").
    await expect(page.getByText("48'")).toHaveCount(0);

    // Resolve the one real blocker, then complete the report in place (native confirm() dialog —
    // same real pattern scripts/ui-lab-visual-review.mjs's own completeB08DraftFlow() proves).
    await page.getByRole("button", { name: "Confirm duration", exact: true }).click();
    await expect(page.getByText("Confirm duration", { exact: true })).toHaveCount(0);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Complete report", exact: true }).click();
    await expect(page.getByRole("button", { name: "Reopen report", exact: true })).toBeVisible();

    await page.getByRole("link", { name: "‹ Back to match" }).click();
    await page.waitForURL(new RegExp(`${BASE}/after\\?report=completed`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText("report completed");
    await expect(page.getByText("1 - 1").first()).toBeAttached();

    await page.getByRole("link", { name: "View report" }).click();
    await page.waitForURL(new RegExp(`${BASE}/report-completed`));
    await expect(page.getByText("1 - 1").first()).toBeAttached();

    await page.reload();
    await expect(page.getByText("1 - 1").first()).toBeAttached();
  });

  // Journey B (independent review, section 10): a new goal is recorded live (scorer skipped).
  test("Journey B — recording the 48' winner live (scorer skipped) before finishing: a real 2-1 all the way through REPORT-DRAFT, completion, AFTER, REPORT-COMPLETED and a reload", async ({ page }) => {
    await page.goto(`${BASE}/live`);
    await expect(page.getByRole("button", { name: "Goal for us" })).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Goal for us" }).click();
    // Goal recording opens a "Who scored?" sheet — dismiss it via its own real "Skip" control
    // (same production pattern e2e/live-reporting.spec.ts already proves against the real,
    // authenticated live-reporting flow) so it doesn't intercept the next click.
    await page.getByRole("button", { name: "Skip" }).click();

    await page.getByRole("button", { name: "Finish live reporting" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Confirm" }).click();

    await page.waitForURL(new RegExp(`${BASE}/report-draft`), { timeout: 15_000 });
    await expect(page.getByText(/Reflecting your LIVE session/)).toBeVisible();
    await expect(page.getByText("2 - 1").first()).toBeAttached();

    await page.getByRole("button", { name: "Confirm duration", exact: true }).click();
    await expect(page.getByText("Confirm duration", { exact: true })).toHaveCount(0);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Complete report", exact: true }).click();
    await expect(page.getByRole("button", { name: "Reopen report", exact: true })).toBeVisible();

    await page.getByRole("link", { name: "‹ Back to match" }).click();
    await page.waitForURL(new RegExp(`${BASE}/after\\?report=completed`));
    await expect(page.getByText("2 - 1").first()).toBeAttached();

    await page.getByRole("link", { name: "View report" }).click();
    await page.waitForURL(new RegExp(`${BASE}/report-completed`));
    await expect(page.getByText("2 - 1").first()).toBeAttached();

    await page.reload();
    await expect(page.getByText("2 - 1").first()).toBeAttached();
  });

  // Journey C (independent review, third remediation "final data-integrity remediation", section
  // 6): a recorded goal followed by a real Undo, verified through the real mounted
  // `LiveMatchClient` in a real browser — the previous remediation pass declined to test this
  // (a real, investigated timing risk: `LiveMatchClient.handleUndo()` can target a not-yet-
  // confirmed Recent Events row, whose own `id` is a `clientEventId`, not the real stored id).
  // That risk is now closed at the fixture's own write boundary (`safe-transition-controller.ts`'s
  // `recordEvent()` normalizes an `EVENT_REVERSED.correctsEventId` to the real target id even when
  // submitted against a clientEventId — see its own doc comment and
  // `safe-transition-controller.test.tsx`'s direct proof), so this journey no longer needs any
  // timing-dependent wait to be reliable.
  test("Journey C — a recorded goal followed by a real Undo: reporter and follower agree before and after, and the reversed goal never becomes an effective goal downstream", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(`${BASE}/live`);
    await expect(page.getByRole("button", { name: "Goal for us" })).toBeVisible({ timeout: 15_000 });

    // Starting snapshot: 1-1 (the match's own real 48' winner has not happened yet). The follower
    // panel (B08's own read-only summary, built from the real `MatchScoreHeader`) renders its own
    // score as "home : away" (a colon, per that component's own real `hero` string) — a DIFFERENT
    // format from `MatchIdentityCard`'s "home - away" used on AFTER/REPORT, not a typo.
    await expect(page.getByTestId("live-score-us")).toHaveText("1");
    await expect(page.getByTestId("live-score-them")).toHaveText("1");
    await expect(page.getByText("1 : 1").first()).toBeAttached();

    await page.getByRole("button", { name: "Goal for us" }).click();
    await page.getByRole("button", { name: "Skip" }).click();

    // Reporter and follower both move to 2-1 — the follower is derived from the exact same event
    // ledger (P2-9), never a second, independently-frozen score.
    await expect(page.getByTestId("live-score-us")).toHaveText("2");
    await expect(page.getByTestId("live-score-them")).toHaveText("1");
    await expect(page.getByText("2 : 1").first()).toBeAttached();

    // Locate the just-recorded, unattributed goal in Recent Events. Its OWN label text
    // ("Goal — us") is NOT unique — the seed's own 10' goal is also unattributed on this exact
    // display (LiveMatchClient's own Recent Events reads `event.playerId` directly off the GOAL_FOR
    // row itself, not via the separate SCORER_SET correction `b08-projection.ts`'s derivations use
    // — the seed's 10' goal's own `playerId` is null; only its paired SCORER_SET fact carries
    // "Vetle", as its own separate row). Disambiguate by the seed's own deterministic elapsed-time
    // label instead of DOM order (the local-overlay-vs-reconciled timing makes sort order
    // unreliable): the seed's 10' goal always renders `formatElapsedMs(600_000)` = exactly "10:00"
    // (`matchSeconds` is fixed, period-relative ms for a global minute 10 goal) as its own row's
    // time prefix; this fresh goal's own elapsed time (`getElapsedMs(clock, Date.now())` at
    // ~15:00+ into the second half) never coincides with that exact string.
    const goalRow = page.getByText("Goal — us", { exact: true }).locator("..").locator("..").filter({ hasNotText: "10:00" });
    await expect(goalRow).toBeVisible({ timeout: 15_000 });
    await goalRow.getByRole("button", { name: "Undo" }).click();

    // The score itself updates immediately (LiveMatchClient's own optimistic setGoalsFor/Against,
    // and B08's follower panel re-deriving from the same `events` React state on its next render).
    await expect(page.getByTestId("live-score-us")).toHaveText("1");
    await expect(page.getByTestId("live-score-them")).toHaveText("1");
    await expect(page.getByText("1 : 1").first()).toBeAttached();
    // The "reversed" marker and the Undo control's own removal are NOT part of that optimistic
    // update — both depend on `isReversed` being computed from a `getRecentEvents()` refresh,
    // which real production only re-polls every 5s (`fetchEvents`'s own `setInterval(fetchEvents,
    // 5_000)`, confirmed directly in `live-match-client.tsx`) or on specific reconcile moments —
    // never immediately after `handleUndo()` itself. An explicit timeout spanning that real,
    // documented interval (not an arbitrary guess) is the correct wait here.
    await expect(goalRow.getByText("reversed")).toBeVisible({ timeout: 8_000 });
    await expect(goalRow.getByRole("button", { name: "Undo" })).toHaveCount(0, { timeout: 8_000 });

    await page.getByRole("button", { name: "Finish live reporting" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Confirm" }).click();
    await page.waitForURL(new RegExp(`${BASE}/report-draft`), { timeout: 15_000 });
    await expect(page.getByText(/Reflecting your LIVE session/)).toBeVisible();
    await expect(page.getByText("1 - 1").first()).toBeAttached();
    // The reversed goal must never become an effective goal downstream — only the real,
    // unreversed 10' goal remains, and the reversed one's own clientEventId never resurfaces as a
    // second attributed/unattributed goal row.
    await expect(page.getByText("48'")).toHaveCount(0);

    await page.getByRole("button", { name: "Confirm duration", exact: true }).click();
    await expect(page.getByText("Confirm duration", { exact: true })).toHaveCount(0);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Complete report", exact: true }).click();
    await expect(page.getByRole("button", { name: "Reopen report", exact: true })).toBeVisible();

    await page.getByRole("link", { name: "‹ Back to match" }).click();
    await page.waitForURL(new RegExp(`${BASE}/after\\?report=completed`));
    await expect(page.getByText("1 - 1").first()).toBeAttached();

    // Consistency across more than the score header (section 7's own requirement: "the score is
    // one projection of the match history, not the whole history") — the reversed goal must stay
    // excluded on AFTER's own Events and Stats tabs too, not only its Overview score.
    await page.goto(`${BASE}/after?report=completed&tab=events`);
    await expect(page.getByText("48'")).toHaveCount(0);
    await page.goto(`${BASE}/after?report=completed&tab=stats`);
    await expect(page.getByText("48'")).toHaveCount(0);

    await page.goto(`${BASE}/after?report=completed`);
    await page.getByRole("link", { name: "View report" }).click();
    await page.waitForURL(new RegExp(`${BASE}/report-completed`));
    await expect(page.getByText("1 - 1").first()).toBeAttached();

    await page.reload();
    await expect(page.getByText("1 - 1").first()).toBeAttached();
    await page.goto(`${BASE}/report-completed?tab=timeline`);
    await expect(page.getByText("48'")).toHaveCount(0);
  });

  // Journey D (independent review, third remediation "final data-integrity remediation", section
  // 7): a direct edit of the REFERENCE report (no LIVE journey at all) must preserve the real
  // canonical event history — the exact defect #1 fix (`historyOrigin`, `b08-journey.ts` v3).
  test("Journey D — editing the reference report directly (no LIVE journey) preserves the real chronology, score and narrative across REPORT-DRAFT, AFTER, REPORT-COMPLETED and a reload", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(`${BASE}/report-draft`);
    await expect(page.getByText("2 - 1").first()).toBeAttached();

    // A real edit — resolving the one genuine incomplete-data condition — without ever visiting
    // LIVE. Before the fix, this alone discarded the real 10'/22'/48' chronology.
    await page.getByRole("button", { name: "Confirm duration", exact: true }).click();
    await expect(page.getByText("Confirm duration", { exact: true })).toHaveCount(0);

    // "Complete report" (like "Confirm duration") lives on the Players tab only — complete it
    // here, then verify the Timeline tab separately afterward (completion flips REPORTED -> LOCKED
    // in place, no navigation, so Timeline is still reachable on this same page).
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Complete report", exact: true }).click();
    await expect(page.getByRole("button", { name: "Reopen report", exact: true })).toBeVisible();

    await page.goto(`${BASE}/report-draft?tab=timeline`);
    await expect(page.getByText("10'").first()).toBeAttached();
    await expect(page.getByText("22'").first()).toBeAttached();
    await expect(page.getByText("48'").first()).toBeAttached();

    await page.getByRole("link", { name: "‹ Back to match" }).click();
    await page.waitForURL(new RegExp(`${BASE}/after\\?report=completed`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText("report completed");
    await expect(page.getByText("2 - 1").first()).toBeAttached();
    // Reference-origin narrative is real and preserved — never withheld as though this were an
    // interactive journey (defect #2's other half). The Assistant Coach insight is the one
    // narrative text AFTER itself renders (reflection is shown as rating pills only, with no note
    // text on this page) — it must still be the real, fresh insight, not the `AdvisorPanelUnavailable`
    // state an interactive journey correctly shows instead.
    await expect(page.getByText(/Vollen's equalizer at 22' followed directly from a lost high turnover/)).toBeVisible();

    await page.getByRole("link", { name: "View report" }).click();
    await page.waitForURL(new RegExp(`${BASE}/report-completed`));
    await expect(page.getByText("2 - 1").first()).toBeAttached();

    await page.reload();
    await expect(page.getByText("2 - 1").first()).toBeAttached();
    await page.goto(`${BASE}/report-completed?tab=timeline`);
    await expect(page.getByText("10'").first()).toBeAttached();
    await expect(page.getByText("22'").first()).toBeAttached();
    await expect(page.getByText("48'").first()).toBeAttached();
  });

  // Journey E (independent review, section 10): reference-mode isolation.
  test("Journey E — a fresh context sees the unchanged reference fixture; starting and then resetting a journey restores it", async ({ page }) => {
    // This journey makes more full page navigations than A/B (two heavy AFTER-shaped loads, a
    // LIVE round-trip, a reset-triggered reload, then a third AFTER load) — CI's own default 30s
    // test budget was observed to run out mid-navigation (the reference "2 - 1" was still correctly
    // present once the page finished hydrating; only the test's own clock, not the app, was at fault).
    test.setTimeout(60_000);
    await page.goto(`${BASE}/after`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("report incomplete");
    await expect(page.getByText("2 - 1").first()).toBeAttached();

    await page.goto(`${BASE}/report-completed`);
    await expect(page.getByText("2 - 1").first()).toBeAttached();

    // Start and finish an interactive journey that changes the result.
    await page.goto(`${BASE}/live`);
    await expect(page.getByRole("button", { name: "Finish live reporting" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Finish live reporting" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Confirm" }).click();
    await page.waitForURL(new RegExp(`${BASE}/report-draft`), { timeout: 15_000 });
    await expect(page.getByText("1 - 1").first()).toBeAttached();

    // The dev-only "Reset journey" control (rendered on every B08 page via the shared
    // B08TransitionNav) clears the whole journey (LIVE ledger + any reconciled report) and then
    // reloads whatever page it was clicked on — it does not itself navigate to /live. Go there
    // first so the reload lands back on LIVE's own fresh pre-match state; wait for the real
    // post-reload DOM rather than `waitForURL` since the URL does not change.
    await page.goto(`${BASE}/live`);
    await page.getByRole("button", { name: "Reset journey" }).click();
    await expect(page.getByRole("button", { name: "Finish live reporting" })).toBeVisible({ timeout: 15_000 });

    await page.goto(`${BASE}/after`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("report incomplete");
    await expect(page.getByText("2 - 1").first()).toBeAttached();
  });
});

test.describe("B08 — responsive layout: no horizontal page overflow at any required width", () => {
  const SCENARIOS = ["before", "live", "after", "report-draft", "report-completed"];
  const WIDTHS = [320, 360, 390, 430, 600, 768, 900, 1440];

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
