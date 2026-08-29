import { test, expect } from "@playwright/test";
import { createFinalizedLiveTestMatch, waitForEventsToSync } from "./helpers/live-match-fixtures";

// Live match reporting coverage (follow-up to ADR-0086/the live-match-realtime-programme).
// Runs under the default "chromium" project (coach-all-a). See
// e2e/helpers/live-match-fixtures.ts for why each test creates its own throwaway match rather
// than reusing/mutating the shared canonical seed dataset.
//
// 90s test timeout: createFinalizedLiveTestMatch's fixture setup now goes through the
// test-only /api/test-agent/seed-finalized-match endpoint (a couple of seconds) instead of
// driving create+generate+finalize through real UI clicks (previously 1-3+ minutes, which is
// why this budget used to be raised as high as 180s) — the remaining time is genuinely just the
// live-reporting flow this test is actually about.

test("start live reporting, record a goal, verify the score updates, then finish cleanly", async ({ page }) => {
  test.setTimeout(90_000);
  const { opponentName } = await createFinalizedLiveTestMatch(page, "Core");

  await page.getByRole("link", { name: "Live reporting" }).click();
  // Cold Vercel functions on CI's freshly forked per-PR Neon branch (ADR-0075) can make this
  // slower than the default 5s expect timeout, confirmed live against the shared hosted Test slot.
  await expect(page).toHaveURL(/\/live$/, { timeout: 15_000 });
  await expect(page.getByText(`vs ${opponentName}`)).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Start live reporting" }).click();
  await expect(page.getByRole("button", { name: "Goal for us" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Goal for us" }).click();
  // The scoreboard's "for us" figure is the only large emerald number on the page.
  await expect(page.locator(".text-emerald-400")).toHaveText("1", { timeout: 10_000 });
  // Goal recording opens a "Who scored?" bottom sheet (auto-dismisses after
  // GOAL_DETAIL_INACTIVITY_TIMEOUT_MS, but that's slow and not what this test is about) —
  // dismiss it explicitly so it doesn't intercept the next click.
  await page.getByRole("button", { name: "Skip" }).click();
  // Wait for the goal event's real recordEvent round trip to the hosted Test slot to actually
  // finish (real network latency, not instant) before finishing the session — otherwise
  // handleEndSession's real getUnsyncedEvents() check (the 2026-08-24 fix) correctly blocks on
  // a still-genuinely-pending event, which is a false negative for *this* test's purpose (that
  // exact blocking behavior is what the second test below verifies deliberately). Passively
  // waiting for "syncing…" text to disappear is a false positive if the attempt instead lands in
  // the terminal "Sync issue" error state (confirmed live in CI) — waitForEventsToSync actively
  // detects and recovers from that case instead of trusting the text's mere absence.
  await waitForEventsToSync(page);

  await page.getByRole("button", { name: "Finish live reporting" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Confirm" }).click();

  // handleEndSession redirects to the seeded post-match report on success.
  await expect(page).toHaveURL(/post-match/, { timeout: 15_000 });
});

test("blocks finishing the session while events are still unsynced, then completes once back online", async ({ page, context }) => {
  test.setTimeout(90_000);
  await createFinalizedLiveTestMatch(page, "OfflineSync");

  await page.getByRole("link", { name: "Live reporting" }).click();
  // Cold Vercel functions on CI's freshly forked per-PR Neon branch (ADR-0075) can make this
  // slower than the default 5s expect timeout, confirmed live against the shared hosted Test slot.
  await expect(page).toHaveURL(/\/live$/, { timeout: 15_000 });
  await page.getByRole("button", { name: "Start live reporting" }).click();
  await expect(page.getByRole("button", { name: "Goal for us" })).toBeVisible({ timeout: 15_000 });

  // Regression test for the 2026-08-24 score data-integrity fix (handleEndSession in
  // live-match-client.tsx): going offline, recording an event, then trying to finish must
  // refuse to end the session and lose the event — not silently proceed with a wrong score.
  await context.setOffline(true);
  await page.getByRole("button", { name: "Goal for us" }).click();
  // saveEventLocally (IndexedDB) succeeds offline even though the server action can't.
  await expect(page.getByText(/waiting to sync|Sync issue/)).toBeVisible({ timeout: 10_000 });
  // Dismiss the "Who scored?" bottom sheet so it doesn't intercept the next click.
  await page.getByRole("button", { name: "Skip" }).click();

  await page.getByRole("button", { name: "Finish live reporting" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/event.*waiting to sync/)).toBeVisible();
  await dialog.getByRole("button", { name: "Confirm" }).click();

  // Must NOT navigate away to the post-match report — the fix blocks ending the session and
  // surfaces an actionable error instead of silently losing the unsynced goal.
  await expect(page).toHaveURL(/\/live$/);
  await expect(page.getByText(/could not sync and would be lost/i)).toBeVisible({ timeout: 10_000 });

  // Back online: the same finish action should now succeed once the event actually syncs. Wait
  // for the real resync round trip first — clicking immediately can race a still-pending or
  // errored sync attempt and hit the same block dialog again.
  await context.setOffline(false);
  await waitForEventsToSync(page);
  await page.getByRole("button", { name: "Finish live reporting" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("alertdialog").getByRole("button", { name: "Confirm" }).click();
  await expect(page).toHaveURL(/post-match/, { timeout: 20_000 });
});
