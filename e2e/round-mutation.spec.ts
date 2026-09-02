import { test, expect } from "@playwright/test";

// Mutation/persistence flow coverage (ADR-0078, follow-up to ADR-0069). Runs under the default
// "chromium" project (coach-all-a). Deliberately self-cleaning: generates real draft selections
// for a real round, verifies they persisted, then clears them back to the round's original
// empty-draft state — so this is safe to run repeatedly against the shared persistent Test slot
// in local development, not only against CI's disposable per-PR Neon branch (ADR-0075).
//
// Targets round A1 W11 (league "Test A1 Fall 2026" in fresh seeds, or "Test A1 Spring 2026" in
// the persistent Test branch) from the canonical seed dataset (scripts/seed-test-dataset.ts) —
// the only round in Org A whose team-names line reads exactly "A1 Blues · A1 Whites" on the
// Rounds list page (round A1 W10 involves those same two teams plus "A1 Reds" — a superset
// that would also match a substring filter on either name alone, which is exactly what broke
// this locator on its first live run).
//
// Navigates via the Fixtures page's league-season selector to find the target DRAFT round,
// regardless of which season resolveActiveLeagueSeason() would pick. The persistent Test database
// accumulates far-future league seasons from live-reporting E2E runs (each
// createFinalizedLiveTestMatch call auto-creates one via resolveOrCreateMatchRoundForDate).
// resolveActiveLeagueSeason() picks one of those over the real (ended) Spring 2026 season,
// so the Rounds list page (/o/test-club-a/rounds) may show the wrong season. The Fixtures page
// (/o/test-club-a/fixtures) fetches ALL league seasons and lets the user select one from a
// dropdown, then shows round cards with "Review board" links that navigate directly to the round
// board by round ID (bypassing resolveActiveLeagueSeason entirely).

test("regenerate round, verify persisted selections, then clear back to empty draft", async ({ page }) => {
  // Round-level generation is a multi-phase pipeline (AGENTS.md: per-match core selection,
  // support resolution, conflict resolution, development routing, squad repair, validation,
  // policy evaluation), each phase a real round trip to the isolated per-PR Neon branch — the
  // default 30s Playwright test timeout is too tight for that plus a possibly-cold serverless
  // function / cold Neon compute on a freshly created branch.
  test.setTimeout(90_000);

  // Navigate via the Fixtures page, which has a league-season selector. The persistent Test
  // database accumulates far-future league seasons from live-reporting E2E runs (each
  // createFinalizedLiveTestMatch call auto-creates one via resolveOrCreateMatchRoundForDate).
  // resolveActiveLeagueSeason() picks one of those over the real (ended) Spring 2026 season,
  // so the Rounds list page would show the wrong season. The Fixtures page lets us select
  // the correct season and navigate directly to the round board from there.
  await page.goto("/o/test-club-a/fixtures");

  // Wait for the Fixtures page to load its data (all league seasons).
  // The league-season select appears when there are 2+ periods.
  const seasonSelect = page.locator("#league-season-select");
  await expect(seasonSelect).toBeVisible({ timeout: 30_000 });

  // Select the target season by value (UUID). Use evaluate to find the option value for the
  // A1 league season that contains the draft round. Try Fall first (fresh seeds), then Spring
  // (persistent Test branch). selectOption by value is more reliable than by label, especially
  // with the duplicated date-range text the option elements produce.
  const targetPeriodValue = await page.evaluate(() => {
    const select = document.querySelector("#league-season-select") as HTMLSelectElement | null;
    if (!select) return null;
    for (const option of select.options) {
      if (option.text.includes("Test A1 Fall 2026")) return option.value;
    }
    for (const option of select.options) {
      if (option.text.includes("Test A1 Spring 2026")) return option.value;
    }
    return null;
  });

  if (targetPeriodValue) {
    await seasonSelect.selectOption(targetPeriodValue);
    // Wait for React state to update and re-render the period sections.
    // The Fixtures page filters displayedPeriods client-side, so the update is
    // near-instant, but we still need to wait for the DOM to reflect the new content.
    // Wait for the heading to show the target season name (not the old default).
    await expect(page.locator("h2").filter({ hasText: "Test A1" })).toBeVisible({ timeout: 10_000 });
  }

  // Find the DRAFT round card containing both "A1 Blues" and "A1 Whites" match rows.
  // On the Fixtures page, each round card is a TacticalSurface (div.rounded-xl) containing
  // match rows with team names like "A1 Blues vs Valley FC". We also filter on "W11" to
  // avoid matching the completed A1 W10 round (which also has A1 Blues but is FINALIZED).
  const targetRoundCard = page.locator("div.rounded-xl").filter({
    has: page.getByText("A1 Blues"),
  }).filter({
    has: page.getByText("A1 Whites"),
  }).filter({
    has: page.getByText("W11"),
  });
  await expect(targetRoundCard).toHaveCount(1, { timeout: 30_000 });

  // Click the "Review board" link for DRAFT rounds (roundPrimaryAction returns this label
  // for selectionState === "DRAFT"). This navigates directly to the round board by round ID,
  // bypassing resolveActiveLeagueSeason entirely.
  const reviewBoardLink = targetRoundCard.getByRole("link", { name: "Review board" });
  await expect(reviewBoardLink).toBeVisible({ timeout: 10_000 });
  await reviewBoardLink.click();

  // Should navigate to the round board page.
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