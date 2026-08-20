import { test, expect } from "@playwright/test";

// Mutation/persistence flow coverage (ADR-0078, follow-up to ADR-0069). Runs under the default
// "chromium" project (coach-all-a). Deliberately self-cleaning: generates real draft selections
// for a real round, verifies they persisted, then clears them back to the round's original
// not-generated state — so this is safe to run repeatedly against the shared persistent Test
// slot in local development, not only against CI's disposable per-PR Neon branch (ADR-0075).
//
// Targets round A1 W11 (league "Test A1 Spring 2026", group A1) from the canonical seed dataset
// (scripts/seed-test-dataset.ts) — the only DRAFT-eligible round in Org A whose team-names line
// reads exactly "A1 Blues · A1 Whites" (round A1 W10 involves those same two teams plus "A1
// Reds" — a superset that would also match a substring filter on either name alone, which is
// exactly what broke this locator on its first live run; round A2 W10 involves "A2
// Eagles"/"A2 Hawks" — an exact-text match on the full two-team line is unique to this one
// round, so no round ID needs to be known ahead of time).

test("generate round, verify persisted selections, then clear back to not-generated", async ({ page }) => {
  await page.goto("/o/test-club-a/rounds");

  const roundCard = page
    .locator("div.rounded-xl")
    .filter({ has: page.getByText("A1 Blues · A1 Whites", { exact: true }) });
  await expect(roundCard).toHaveCount(1);

  const generateButton = roundCard.getByRole("button", { name: "Generate squads" });
  await expect(generateButton).toBeVisible();
  await generateButton.click();

  // round-list-client.tsx swaps the NOT_GENERATED action block for a DRAFT/BLOCKED/READY block
  // (with a "Finalize round" button) once generateRoundAction resolves and the list refreshes.
  await expect(roundCard.getByRole("button", { name: "Finalize round" })).toBeVisible({ timeout: 15_000 });

  await roundCard.getByRole("link").click();
  await expect(page).toHaveURL(/\/o\/test-club-a\/rounds\//);

  // Real persisted draft selections: at least one player chip is now on the board.
  await expect(page.locator('[aria-label^="Remove "]').first()).toBeVisible();

  const clearButton = page.getByRole("button", { name: "Clear", exact: true });
  await expect(clearButton).toBeVisible();
  await clearButton.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Clear round draft")).toBeVisible();
  await dialog.getByRole("button", { name: "Clear round" }).click();

  // Reverted to not-generated: no player chips remain, no danger-zone Clear control left to click.
  await expect(page.locator('[aria-label^="Remove "]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Clear", exact: true })).toHaveCount(0);
});
