import { test, expect } from "@playwright/test";

// C06-B (Gate C W2 remediation — PR #829) browser-level integration coverage: proves the real
// completed-match positional evidence integration lands in the ACTUAL production Lineup/
// Formation editor (`src/components/matches/match-tactics-panel.tsx` → `PlayerPicker`/
// `PositionFitList`), not just in isolated component tests. Uses the test-agent
// seed-lineup-evidence-match endpoint (see its own doc comment) to create a real history match
// with a genuine, completed `ActualPositionInterval` row for one player at Centre Midfield, and
// a separate, unrelated future match whose own (empty) Lineup the spec actually drives through
// the real UI.
//
// round-mutation.spec.ts documents a cold-start timeout risk for a DIFFERENT heavy multi-write
// test-agent seed endpoint, specific to that endpoint's own measured behavior after the Next.js
// 16 proxy migration -- it is not a blanket rule about every seed endpoint. An earlier version
// of this spec speculatively skipped itself in CI on that basis without ever actually measuring
// this endpoint; that guard is removed so this spec runs for real on every CI acceptance run,
// which is the only way to find out whether the risk actually applies here.

test("the real Lineup editor shows a candidate's real completed-match evidence, and the evidence survives assignment and the selected-player inspector", async ({ page }) => {
  test.setTimeout(120_000);

  const opponentName = `E2E C06-B ${Date.now()}`;
  const startsAt = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();

  const seedResponse = await page.request.post("/api/test-agent/seed-lineup-evidence-match", {
    data: { teamName: "A1 Blues", opponentName, startsAt },
    timeout: 90_000,
  });
  if (!seedResponse.ok()) {
    throw new Error(`seed-lineup-evidence-match failed (${seedResponse.status()}): ${await seedResponse.text()}`);
  }
  const { matchId, evidencePlayerName } = (await seedResponse.json()) as {
    matchId: string;
    evidencePlayerName: string;
  };

  await page.goto(`/o/test-club-a/matches/${matchId}`);
  await expect(page.getByText("Lineup")).toBeVisible({ timeout: 20_000 });

  // Open the one empty Centre Midfield slot's picker from the "Empty slots" list.
  await page.getByRole("button", { name: /CM.*Midfielder|Midfielder.*CM/i }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 10_000 });

  // The seeded evidence player's candidate row shows real completed-match evidence —
  // "Played here in 1 match (90 min)" — not a silent/blended score (ADR-0129 §5).
  const candidateRow = dialog.getByRole("button", { name: new RegExp(evidencePlayerName) });
  await expect(candidateRow).toBeVisible();
  await expect(candidateRow.getByText("Played here in 1 match (90 min)")).toBeVisible();
  await test.info().attach("c06b-player-picker-evidence", { body: await page.screenshot(), contentType: "image/png" });

  // Assign the evidence player — the coach's manual choice remains authoritative; evidence never
  // auto-assigns or blocks this click.
  await candidateRow.click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });

  // The pitch now shows the real assignment. Click the shirt token to open the selected-player
  // inspector and confirm the same real evidence appears there too, as a role-chip caption
  // (never changing the declared-fit tier grouping itself — ADR-0129 §5).
  const shirtToken = page.getByRole("button", { name: new RegExp(`${evidencePlayerName.split(" ")[0]}.*—.*CM`) });
  await expect(shirtToken).toBeVisible({ timeout: 10_000 });
  await shirtToken.click();

  await expect(page.getByText("Positional fit")).toBeVisible({ timeout: 10_000 });
  const cmChip = page.getByText("CM", { exact: true }).first();
  await expect(cmChip).toHaveAttribute("title", "1 match, 90 min");
  await test.info().attach("c06b-selected-player-inspector-evidence", { body: await page.screenshot(), contentType: "image/png" });

  // Reload to prove the exact tactical-position assignment persisted, not just the in-memory UI
  // state (brief's "exact tactical-position persistence"/"assignment changes and reloads").
  await page.reload();
  await expect(page.getByRole("button", { name: new RegExp(`${evidencePlayerName.split(" ")[0]}.*—.*CM`) })).toBeVisible({ timeout: 20_000 });
});
