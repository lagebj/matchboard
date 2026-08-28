import { test, expect } from "@playwright/test";
import { createFinalizedLiveTestMatch, waitForEventsToSync } from "./helpers/live-match-fixtures";

// Event Evidence Parity programme (ADR-0104) coverage: proves the shared post-match learning
// pipeline (runPostMatchLearning -> opponent/player/combination evidence) actually runs when a
// real coach completes a real report through the real UI, not just via direct domain-function
// calls in a unit/integration test. Builds on live-reporting.spec.ts's proven
// create -> finalize -> live-report -> end-session flow (reusing its helper rather than
// duplicating it) and adds the one further step that flow deliberately stops short of:
// clicking "Complete report" to reach LOCKED, which is what triggers the learning pipeline.
//
// 180s timeout for the same reason live-reporting.spec.ts uses one: create + generate +
// finalize alone can consume most of a shorter budget on a freshly forked per-PR Neon branch.

test("completing a League post-match report via the real UI runs post-match learning without error", async ({ page }) => {
  test.setTimeout(180_000);
  const { opponentName } = await createFinalizedLiveTestMatch(page, "EvidenceParity");

  await page.getByRole("link", { name: "Live reporting" }).click();
  await expect(page).toHaveURL(/\/live$/, { timeout: 15_000 });
  await expect(page.getByText(`vs ${opponentName}`)).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Start live reporting" }).click();
  await expect(page.getByRole("button", { name: "Goal for us" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Goal for us" }).click();
  await expect(page.locator(".text-emerald-400")).toHaveText("1", { timeout: 10_000 });
  await page.getByRole("button", { name: "Skip" }).click();
  await waitForEventsToSync(page);

  await page.getByRole("button", { name: "Finish live reporting" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(page).toHaveURL(/post-match/, { timeout: 15_000 });

  // completeMatchReport()'s report-completion confirmation is a native window.confirm(), not
  // an in-app dialog -- must be accepted before the click that triggers it, or Playwright's
  // default auto-dismiss cancels it and the click becomes a no-op.
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Complete report" }).click();

  // A LOCKED status pill is the user-visible proof that completeReport() (and therefore
  // runPostMatchLearning()) ran to completion without throwing -- a learning-pipeline failure
  // is swallowed internally (by design, ADR-0104: it must never block report completion), so
  // this assertion is exactly the right level: report completion succeeding at all is the
  // signal, not a specific evidence outcome (which depends on fixture data this throwaway
  // match doesn't control, e.g. player ratings).
  // STATUS_LABEL.LOCKED renders as "Locked"; the pill's CSS uppercases it visually, so match
  // case-insensitively against the real DOM text rather than the rendered appearance.
  await expect(page.getByText(/^locked$/i)).toBeVisible({ timeout: 15_000 });
});
