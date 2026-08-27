import { test, expect } from "@playwright/test";

// Mutation/persistence flow coverage (ADR-0078, follow-up to ADR-0069). Runs under the default
// "chromium" project (coach-all-a). Deliberately self-cleaning: generates real draft selections
// for a real round, verifies they persisted, then clears them back to the round's original
// empty-draft state — so this is safe to run repeatedly against the shared persistent Test slot
// in local development, not only against CI's disposable per-PR Neon branch (ADR-0075).
//
// Targets round A1 W11 (league "Test A1 Spring 2026", group A1) from the canonical seed dataset
// (scripts/seed-test-dataset.ts) — the only round in Org A whose team-names line reads exactly
// "A1 Blues · A1 Whites" (round A1 W10 involves those same two teams plus "A1 Reds" — a superset
// that would also match a substring filter on either name alone, which is exactly what broke
// this locator on its first live run; round A2 W10 involves "A2 Eagles"/"A2 Hawks" — an
// exact-text match on the full two-team line is unique to this one round, so no round ID needs
// to be known ahead of time).
//
// The seed dataset creates every non-finalized round with dbStatus "DRAFT" already (there is no
// separate "not generated" MatchRound.status value — see src/lib/round-status.ts), so round A1
// W11 already derives to "DRAFT" even with zero selections, and the Round Board's "Regenerate"
// control (round-board.tsx, shown whenever roundStatus === "DRAFT") is what actually runs full
// generation from that empty state — a plain list-page "Generate squads" control only appears
// for the (here unreachable) NOT_GENERATED derived status, which the first live run against this
// spec surfaced was not this round's actual state.

test("regenerate round, verify persisted selections, then clear back to empty draft", async ({ page }) => {
  // Round-level generation is a multi-phase pipeline (AGENTS.md: per-match core selection,
  // support resolution, conflict resolution, development routing, squad repair, validation,
  // policy evaluation), each phase a real round trip to the isolated per-PR Neon branch — the
  // default 30s Playwright test timeout is too tight for that plus a possibly-cold serverless
  // function / cold Neon compute on a freshly created branch.
  test.setTimeout(90_000);

  await page.goto("/o/test-club-a/rounds");

  // Wait for the rounds list to hydrate before filtering — the list loads
  // asynchronously and the round cards may not be present on first render.
  await page.waitForSelector("div.rounded-xl", { timeout: 30_000 });

  const roundCard = page
    .locator("div.rounded-xl")
    .filter({ has: page.getByText("A1 Blues · A1 Whites", { exact: true }) });
  await expect(roundCard).toHaveCount(1, { timeout: 30_000 });

  await roundCard.getByRole("link").click();
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
