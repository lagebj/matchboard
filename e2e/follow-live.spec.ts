import { test, expect } from "@playwright/test";
import { createFinalizedLiveTestMatch, waitForEventsToSync } from "./helpers/live-match-fixtures";

// Two-actor "Follow live" coverage (ADR-0086 amendment, live-match-realtime-programme).
// Runs under the default "chromium" project as the reporting coach (coach-all-a). The
// following coach is a second, genuinely distinct login (coach-a1 — GROUP_COACH on group A1,
// same group as coach-all-a, but not the same account), opened via a manual
// browser.newContext({ storageState: "e2e/.auth/coach-a1.json" }) rather than a second
// Playwright project, since both personas are needed live within the same test.
//
// This exercises the real Cloudflare Durable Object realtime path end-to-end — the ticket
// route, WebSocket upgrade, and the Worker's own auth/session checks — not just the app's own
// code, which is exactly what code review alone could not confirm or deny for the "Connection
// problem" issue this spec is written to reproduce/verify.
//
// 240s test timeout (was 180s, itself already raised from the usual 90s): confirmed live in CI
// that create + generate + finalize alone can consume most of a 90s budget on a freshly forked
// per-PR Neon branch (cold compute), leaving no headroom for the connection test itself — the
// failure wasn't any single step being slow, it was the cumulative pipeline exceeding the total
// budget. Raised again to 240s once the reporter's own session-ending cleanup (below) was added
// to every exit path: confirmed live that 180s was no longer enough once that additional real
// work (waitForEventsToSync + the finish-reporting confirm dialog) is included in the budget.
test("a second coach can follow a live match in real time via the Cloudflare realtime path", async ({ page, browser }) => {
  test.setTimeout(240_000);
  const { matchId } = await createFinalizedLiveTestMatch(page, "FollowLive");

  await page.getByRole("link", { name: "Live reporting" }).click();
  // Cold Vercel functions on CI's freshly forked per-PR Neon branch (ADR-0075) can make this
  // slower than the default 5s expect timeout, confirmed live against the shared hosted Test slot.
  await expect(page).toHaveURL(/\/live$/, { timeout: 15_000 });
  await page.getByRole("button", { name: "Start live reporting" }).click();
  await expect(page.getByRole("button", { name: "Goal for us" })).toBeVisible({ timeout: 15_000 });

  // Explicitly end the reporter's own live session on every exit path (pass, fail, or a later
  // assertion throwing) — confirmed live that leaving this session ACTIVE (relying solely on
  // Playwright's browser-context teardown) leaks the underlying Cloudflare Durable Object
  // connection instead of cleanly closing it, and compounds across a CI run's retries.
  try {
    const followerContext = await browser.newContext({ storageState: "e2e/.auth/coach-a1.json" });
    const followerPage = await followerContext.newPage();

    try {
      await followerPage.goto(`/o/test-club-a/matches/${matchId}/live/follow`);

      // "Live" is the connected-state label (CONNECTION_LABEL.connected in follow-live-client.tsx).
      // A generous timeout: this is a real WebSocket round trip through the Worker, not a mock.
      await expect(followerPage.getByText("Live", { exact: true })).toBeVisible({ timeout: 20_000 });
      await expect(followerPage.getByText("Live following isn't available right now.")).toHaveCount(0);

      // Confirm the connection is genuinely live, not just the initial label — an event the
      // reporter records should actually arrive over the realtime broadcast. follow-live-client.tsx
      // now renders events using getEventTypeLabel(), so "GOAL_FOR" becomes "Goal — us" (possibly
      // followed by " — Player Name" if the player ID resolves in the player map).
      await page.getByRole("button", { name: "Goal for us" }).click();
      await expect(followerPage.getByText("Goal — us", { exact: false })).toBeVisible({ timeout: 15_000 });
    } finally {
      await followerContext.close();
    }
  } finally {
    await waitForEventsToSync(page);
    await page.getByRole("button", { name: "Finish live reporting" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Confirm" }).click();
    await expect(page).toHaveURL(/post-match/, { timeout: 15_000 });
  }
});
