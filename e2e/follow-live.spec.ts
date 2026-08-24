import { test, expect } from "@playwright/test";
import { createFinalizedLiveTestMatch } from "./helpers/live-match-fixtures";

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

test("a second coach can follow a live match in real time via the Cloudflare realtime path", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const { matchId } = await createFinalizedLiveTestMatch(page, "FollowLive");

  await page.getByRole("link", { name: "Live reporting" }).click();
  // Cold Vercel functions on CI's freshly forked per-PR Neon branch (ADR-0075) can make this
  // slower than the default 5s expect timeout, confirmed live against the shared hosted Test slot.
  await expect(page).toHaveURL(/\/live$/, { timeout: 15_000 });
  await page.getByRole("button", { name: "Start live reporting" }).click();
  await expect(page.getByRole("button", { name: "Goal for us" })).toBeVisible({ timeout: 15_000 });

  const followerContext = await browser.newContext({ storageState: "e2e/.auth/coach-a1.json" });
  const followerPage = await followerContext.newPage();

  try {
    await followerPage.goto(`/o/test-club-a/matches/${matchId}/live/follow`);

    // "Live" is the connected-state label (CONNECTION_LABEL.connected in follow-live-client.tsx).
    // A generous timeout: this is a real WebSocket round trip through the Worker, not a mock.
    await expect(followerPage.getByText("Live", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(followerPage.getByText("Live following isn't available right now.")).toHaveCount(0);

    // Confirm the connection is genuinely live, not just the initial label — an event the
    // reporter records should actually arrive over the realtime broadcast.
    await page.getByRole("button", { name: "Goal for us" }).click();
    await expect(followerPage.getByText("goal for us", { exact: false })).toBeVisible({ timeout: 10_000 });
  } finally {
    await followerContext.close();
  }
});
