import { type Page, expect } from "@playwright/test";

/**
 * Shared setup for live-reporting.spec.ts and follow-live.spec.ts. A deliberate, small
 * deviation from this repo's usual one-spec-per-file self-contained convention (see
 * round-mutation.spec.ts, smoke.spec.ts) — the create → generate → finalize sequence is
 * intricate enough that duplicating it across two files risked drift, not simplicity.
 *
 * These specs test live reporting/following, not the create/generate/finalize UI flow itself
 * (already covered by round-mutation.spec.ts/smoke.spec.ts) — so fixture setup goes through
 * /api/test-agent/seed-finalized-match (a test-only endpoint, disabled outside MATCHBOARD_ENV=test
 * per isTestAgentAuthEnabled(), calling the exact same domain functions — createMatchCore,
 * refreshDraftRound, finalizeSingleMatch — the real UI actions call, never a reimplementation)
 * instead of driving the whole pipeline through real UI clicks. Measured live: the UI-driven
 * version cost 1-3+ minutes of setup per test (create → find-round-on-an-ever-growing-list →
 * regenerate → finalize → hunt for the match on Fixtures) and, under load, could exceed even a
 * generous per-step timeout budget; this does the same real writes in a couple of seconds.
 *
 * Unlike round-mutation.spec.ts, this cannot be made self-cleaning: finalizing creates real
 * FINALIZED selections and (once a live session is ended) a permanent PostMatchReport, and
 * there is no "delete match"/"un-finalize and delete" UI action. This is accepted as ongoing
 * accumulation in the shared Test dataset — each match is single-use fixture data, not shared
 * reference data other specs depend on, and mutating the canonical seed dataset instead would
 * require a real re-seed of the persistent Test branch (ADR-0075).
 *
 * Match date is spread into a wide, randomized future range (not "today") — matches are
 * assigned to rounds by ISO week (resolveOrCreateMatchRoundForDate), so every match dated
 * "today" lands in the exact same shared round. Discovered live: round-level generation
 * resolves core/support jointly across every match in a round, so repeated runs on the same
 * day progressively starved each other's player pool (first run: 3 core + 3 support; second
 * run minutes later, same round: 0/11) — not a flaky test, a real shared-fixture collision.
 *
 * Confirmed live a second time after the /api/test-agent/seed-finalized-match fast-setup
 * endpoint replaced the old multi-minute UI-driven flow (see createFinalizedLiveTestMatch):
 * one spec's request timed out client-side (ETIMEDOUT) but had already succeeded server-side
 * (match created, round generated and finalized); the test's Playwright-level retry then drew a
 * second random date that landed in the same ~500-week window and collided with that
 * already-finalized round ("Finalised matches cannot be recalculated"). A 500-week spread was
 * "astronomically unlikely" to collide across the old, slow, few-and-far-between UI-driven
 * calls, but the fast endpoint made setup cheap enough that retries now draw many more dates
 * per run, meaningfully raising the birthday-paradox collision odds. Widening the spread to
 * ~5000 weeks (~100 years) restores the original safety margin.
 *
 * Confirmed live a third time, 2026-08-30 (PR #389, an unusually long-lived 17-commit PR): the
 * per-PR Neon branch (pr-389) is reused and never cleaned across the PR's entire life (see
 * "cannot be made self-cleaning" above), so every commit's live-reporting.spec.ts/
 * follow-live.spec.ts run drew more dates from the same fixed 5000-week pool, and the birthday-
 * paradox odds climbed with every additional commit -- two separate CI runs on this PR hit this
 * exact collision class, both surfacing as "Finalised matches cannot be recalculated". The team
 * already widened this pool once before for the identical underlying mechanism (500 -> 5000
 * weeks); that margin was sized for a typical PR's commit count, not an outlier this long. Fixed
 * two ways instead of widening the pool a third time: (1) `process.hrtime.bigint()`
 * (nanosecond-resolution, effectively never repeats within a process) replaces `Math.random()`,
 * so two calls within the same test run can no longer coincidentally draw the same date at all --
 * not just less likely to, closing the exact retry-collision class documented above outright; (2)
 * the pool itself is widened another order of magnitude (5000 -> 50,000 weeks, ~960 years -- test
 * dates only need to be distinct, never plausible), cutting cross-run birthday-paradox odds by
 * roughly 10x for the same number of draws, so a long-lived PR needs roughly 10x more commits
 * before the same
 * failure mode resurfaces.
 *
 * The OTHER error message seen in this same incident round ("This date is outside the current
 * league season...") turned out to be a SEPARATE, real bug, not another instance of the
 * birthday-paradox mechanism above: `createMatchCore()`
 * (`src/app/(app)/matches/actions.ts`) looked up the covering league season by whether it
 * overlapped the match's whole ISO week, but `resolveOrCreateMatchRoundForDate()` then validates
 * the match's *exact* startsAt against that season's exact bounds -- a mismatch whenever a
 * match's week straddles a season boundary (season cutoffs are Jan1/Jun30/Jul1/Dec31, not
 * generally ISO-week-aligned). A wider/more-unique random date pool doesn't touch this at all;
 * fixed at the source instead (createMatchCore now looks up by the exact startsAt), with a
 * regression test in `src/app/(app)/matches/__tests__/create-match-core.test.ts`. This is a real
 * product bug (also reachable from the real "add match" UI for any coach scheduling a match in
 * the first few days of a new league-season half), not test-only fallout.
 */
function randomFutureMatchDate(): Date {
  const entropy = Number(process.hrtime.bigint() % BigInt(50_000));
  const weeksOut = 60 + entropy;
  return new Date(Date.now() + weeksOut * 7 * 24 * 60 * 60 * 1000);
}

export async function createFinalizedLiveTestMatch(page: Page, label: string): Promise<{ opponentName: string; matchId: string }> {
  const opponentName = `E2E Live ${label} ${Date.now()}`;
  const matchDate = randomFutureMatchDate();

  // Explicit generous timeout: confirmed live that the default (30s) request timeout can be
  // exceeded by this endpoint's three sequential DB-heavy operations (create match, regenerate
  // round, finalize match) against a cold Vercel function on a freshly forked per-PR Neon branch
  // — a client-side timeout here does not stop the server-side work, so a timed-out-but-actually-
  // successful request previously drove the date-collision failure documented above.
  const response = await page.request.post("/api/test-agent/seed-finalized-match", {
    data: {
      teamName: "A1 Blues",
      opponentName,
      startsAt: matchDate.toISOString(),
    },
    timeout: 45_000,
  });
  if (!response.ok()) {
    throw new Error(`seed-finalized-match failed (${response.status()}): ${await response.text()}`);
  }
  const { matchId } = (await response.json()) as { matchId: string };

  await page.goto(`/o/test-club-a/matches/${matchId}`);
  // match-detail.tsx's server component runs several sequential DB queries (team, matchRound +
  // leagueSeason, selections, postMatchReport, liveSession, warnings, coachingIntent,
  // opponentHistory) before rendering — genuinely slower under cold-start conditions than a
  // lighter navigation.
  await expect(page.getByRole("link", { name: "Live reporting" })).toBeVisible({ timeout: 20_000 });

  return { opponentName, matchId };
}

/**
 * Waits for a just-recorded live-match event to actually finish syncing (SyncStatusIndicator
 * clears), actively nudging a retry if it lands in the "Sync issue" error state rather than
 * passively waiting — confirmed live in CI: a single recordEvent round trip can genuinely fail
 * (not just run slow) against a cold Vercel function on a freshly forked branch, and passively
 * waiting for "syncing…" text to disappear is a false negative in that case (the text disappears
 * because the attempt already gave up, not because it succeeded). Mirrors what the app itself
 * does on network recovery (the "online" window event handler in live-match-client.tsx) rather
 * than reimplementing retry logic — this is a nudge, not a different code path.
 */
export async function waitForEventsToSync(page: Page, timeoutMs = 45_000): Promise<void> {
  await expect(async () => {
    const stillPending = await page.getByText(/event.*syncing/).isVisible().catch(() => false);
    const hasError = await page.getByText(/Sync issue/).isVisible().catch(() => false);
    if (hasError) {
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
    }
    expect(stillPending || hasError).toBe(false);
  }).toPass({ timeout: timeoutMs, intervals: [1_000, 2_000, 3_000, 5_000] });
}
