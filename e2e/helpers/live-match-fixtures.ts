import { type Page, expect } from "@playwright/test";

/**
 * Shared setup for live-reporting.spec.ts and follow-live.spec.ts. A deliberate, small
 * deviation from this repo's usual one-spec-per-file self-contained convention (see
 * round-mutation.spec.ts, smoke.spec.ts) — the create → generate → finalize sequence below is
 * intricate enough that duplicating it across two files risked drift, not simplicity.
 *
 * Creates a throwaway match via the real /matches/new form (unique opponent name, so parallel/
 * repeated runs never collide), generates and finalizes its squad so "Live reporting" becomes
 * available (match-detail.tsx gates that button on `isMatchFinalized(match.selections)` — a
 * freshly created match has none), and returns to the match detail page.
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
 * Spreading ~1-10 years out makes same-round collisions between runs astronomically unlikely.
 */
function randomFutureMatchDateInput(): string {
  const weeksOut = 60 + Math.floor(Math.random() * 500);
  const date = new Date(Date.now() + weeksOut * 7 * 24 * 60 * 60 * 1000);
  return date.toISOString().split("T")[0];
}

export async function createFinalizedLiveTestMatch(page: Page, label: string): Promise<{ opponentName: string; matchId: string }> {
  const opponentName = `E2E Live ${label} ${Date.now()}`;

  await page.goto("/o/test-club-a/matches/new");
  await page.locator("#teamId").selectOption({ label: "A1 Blues" });
  await page.locator("#opponent-select").fill(opponentName);
  await page.locator("#startsAt").fill(randomFutureMatchDateInput());
  // Blur the combobox so it commits the free-text value into the hidden `opponent` field
  // instead of staying "open" and intercepting the next click.
  await page.locator("#teamId").click();
  await page.getByRole("button", { name: "Create match" }).click();

  // The default 5s expect timeout isn't enough here on CI's isolated per-PR Neon branch (ADR-0075)
  // — createMatchAction's server round trip is genuinely slower against a freshly forked branch's
  // cold Vercel functions than against the already-warm shared hosted Test slot. Confirmed live:
  // this exact assertion timed out in CI while working reliably locally.
  await expect(page).toHaveURL(/\/o\/test-club-a\/fixtures/, { timeout: 20_000 });

  // Fixtures' period selector defaults to whichever league season isCurrent (see
  // FixturePeriod.isCurrent) and this match's far-future date deliberately isn't it — so rather
  // than hunt through periods, use /rounds instead: it lists every MatchRound unfiltered by
  // period, ordered by createdAt desc (src/app/(app)/o/[orgSlug]/rounds/page.tsx), so the round
  // this match just created is always the very first card.
  await page.goto("/o/test-club-a/rounds");
  const roundCard = page.locator("div.rounded-xl").first();
  await roundCard.getByRole("link").click();
  await expect(page).toHaveURL(/\/o\/test-club-a\/rounds\//, { timeout: 15_000 });

  await page.getByRole("button", { name: "Regenerate" }).click();
  // Real persisted draft selections: at least one player chip is now on the board.
  await expect(page.locator('[aria-label^="Remove "]').first()).toBeVisible({ timeout: 45_000 });

  // Per-match finalization directly from the round board (round-board.tsx's lock-icon button,
  // showFinalizeMatch) — this round has exactly one match, so there's exactly one such button.
  await page.getByRole("button", { name: "Finalise this match" }).click();
  const finalizeDialog = page.getByRole("dialog");
  await expect(finalizeDialog).toBeVisible();
  await finalizeDialog.getByRole("button", { name: "Finalise match" }).click();
  await expect(finalizeDialog).toBeHidden({ timeout: 10_000 });

  // The round board has no link back to match detail — locate it via Fixtures instead. The
  // period selector defaults to isCurrent (not this far-future match's period), so search every
  // period option rather than guess its computed title/date-range label.
  await page.goto("/o/test-club-a/fixtures");
  const matchLink = page.getByRole("link", { name: new RegExp(`vs ${opponentName}$`) });
  const periodSelect = page.locator("#league-season-select");
  // fixtures-page.tsx only renders #league-season-select when data.periods.length > 1 — on a
  // fresh/isolated branch with few accumulated periods, this match may be the *only* period, in
  // which case the selector never appears at all and searching for it would hang forever.
  // Wait for the match link directly first (covers both "only period" and "already isCurrent"
  // cases, and the initial client-side fetch settling — "Loading fixtures…" beforehand); only
  // fall back to hunting through the multi-period selector if that genuinely times out.
  const foundDirectly = await matchLink
    .waitFor({ state: "visible", timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
  if (!foundDirectly) {
    await expect(periodSelect).toBeVisible({ timeout: 5_000 });
    const optionValues = await periodSelect.locator("option").evaluateAll((opts) => opts.map((o) => (o as HTMLOptionElement).value));
    for (const value of optionValues) {
      await periodSelect.selectOption(value);
      // selectOption's change event is synchronous, but the filtered period's content is a
      // React re-render — an immediate isVisible() check races ahead of it and always sees the
      // previous period's DOM. Give each option a real (short) chance to render before moving on.
      const found = await matchLink
        .waitFor({ state: "visible", timeout: 2_000 })
        .then(() => true)
        .catch(() => false);
      if (found) break;
    }
  }
  await expect(matchLink).toBeVisible({ timeout: 15_000 });
  await matchLink.click();
  await expect(page).toHaveURL(/\/o\/test-club-a\/matches\/([^/]+)$/, { timeout: 15_000 });

  const urlMatch = page.url().match(/\/matches\/([^/]+)$/);
  if (!urlMatch) throw new Error(`Could not extract matchId from URL: ${page.url()}`);
  const matchId = urlMatch[1];

  // match-detail.tsx's server component runs several sequential DB queries (team, matchRound +
  // leagueSeason, selections, postMatchReport, liveSession, warnings, coachingIntent,
  // opponentHistory) before rendering — genuinely slower under cold-start conditions than the
  // other, lighter navigations above.
  await expect(page.getByRole("link", { name: "Live reporting" })).toBeVisible({ timeout: 20_000 });

  return { opponentName, matchId };
}
