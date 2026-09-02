import { test, expect } from "@playwright/test";

// Mutation/persistence flow coverage (ADR-0078, follow-up to ADR-0069). Runs under the default
// "chromium" project (coach-all-a). Deliberately self-cleaning: generates real draft selections
// for a real round, verifies they persisted, then clears them back to the round's original
// empty-draft state — so this is safe to run repeatedly against the shared persistent Test slot
// in local development, not only against CI's disposable per-PR Neon branch (ADR-0075).
//
// Uses the test-agent seed-draft-match endpoint to create a fresh DRAFT round with future
// matches (whose planning boundary is still open), then navigates directly to the round board
// by round ID — bypassing resolveActiveLeagueSeason entirely. The persistent Test database
// accumulates far-future FINALIZED rounds from live-reporting E2E runs (each
// createFinalizedLiveTestMatch call auto-creates one via resolveOrCreateMatchRoundForDate), so
// navigating via the Rounds list page would show the wrong season. Navigating by round ID
// sidesteps this problem completely.
//
// The endpoint creates a match with startsAt 14 days from now (well within the planning
// boundary), generates draft selections for the round, and returns the round ID — but does NOT
// capture the planning baseline, so the round stays in DRAFT state with the Regenerate button
// available.

test("regenerate round, verify persisted selections, then clear back to empty draft", async ({ page }) => {
  // Round-level generation is a multi-phase pipeline (AGENTS.md: per-match core selection,
  // support resolution, conflict resolution, development routing, squad repair, validation,
  // policy evaluation), each phase a real round trip to the isolated per-PR Neon branch — the
  // default 30s Playwright test timeout is too tight for that plus a possibly-cold serverless
  // function / cold Neon compute on a freshly created branch.
  test.setTimeout(120_000);

  // Warm up the serverless function and Neon connection before the heavy seed call.
  // On a cold deployment (first request after deploy), the proxy + API route + Neon
  // cold start can exceed the request timeout. A warm-up request through the auth-wrapped
  // path ensures the proxy function, auth layer, and database connection pool are warm.
  // /api/auth/session is a lightweight authenticated endpoint that exercises the full
  // proxy → auth → DB path without modifying any data.
  await page.request.get("/api/auth/session");

  // Create a fresh DRAFT round with future matches via the test-agent API.
  // startsAt is 14 days from now — well within the planning boundary, so the round stays DRAFT.
  const startsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const seedResponse = await page.request.post("/api/test-agent/seed-draft-match", {
    data: {
      teamName: "A1 Blues",
      opponentName: `E2E Draft ${Date.now()}`,
      startsAt,
    },
    timeout: 60_000,
  });
  if (!seedResponse.ok()) {
    throw new Error(`seed-draft-match failed (${seedResponse.status()}): ${await seedResponse.text()}`);
  }
  const { matchRoundId } = (await seedResponse.json()) as { matchRoundId: string };

  // Navigate directly to the round board by round ID, bypassing resolveActiveLeagueSeason.
  await page.goto(`/o/test-club-a/rounds/${matchRoundId}`);
  await expect(page).toHaveURL(/\/o\/test-club-a\/rounds\//);

  const regenerateButton = page.getByRole("button", { name: "Regenerate" });
  // The round board renders asynchronously and the Regenerate button may be
  // briefly disabled during hydration — wait for it to become enabled.
  await expect(regenerateButton).toBeEnabled({ timeout: 30_000 });
  await regenerateButton.click();

  // Real persisted draft selections: at least one player chip is now on the board.
  await expect(page.locator('[aria-label^="Remove "]').first()).toBeVisible({ timeout: 45_000 });

  const clearButton = page.getByRole("button", { name: "Clear", exact: true });
  // isPending (set by the same startTransition the Regenerate click used) disables every button
  // in this row until regenerateRoundAction's promise and the following router.refresh() both
  // settle — wait for genuinely enabled, not just present in the DOM.
  await expect(clearButton).toBeEnabled({ timeout: 45_000 });
  await clearButton.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Clear round draft")).toBeVisible();
  const confirmClearButton = dialog.getByRole("button", { name: "Clear round" });
  await expect(confirmClearButton).toBeEnabled();
  await confirmClearButton.click();

  // Reverted to an empty draft: no player chips remain, no danger-zone Clear control left to
  // click (round-board.tsx only renders it while roundStatus === "DRAFT" — clearing doesn't
  // change dbStatus, so this specifically confirms the draft selections are gone, not that the
  // round left the DRAFT state).
  await expect(page.locator('[aria-label^="Remove "]')).toHaveCount(0, { timeout: 15_000 });
  await expect(regenerateButton).toBeVisible();
});