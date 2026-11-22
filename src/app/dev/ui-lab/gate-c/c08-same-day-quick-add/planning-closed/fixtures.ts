import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import { gateCW3QuickAddFacts } from "../../w3-shared/fixtures";

/**
 * C08-C — Planning closed (register C08). Confirmed against the real planner
 * (`today-selection-recommendation-plan.ts`): once the only candidate destination's planning
 * boundary is closed, `resolveTarget()` returns `null` and `TodaySelectionDecision.recommendation`
 * is `null` entirely — not a degraded object with an explanatory reason. The row therefore falls
 * back to the real plain "Review on the Round Board." default text (never a misleading one-click
 * action), which is intentionally less specific than the tentative-availability case (C08-B) —
 * disclosed as an observation, not a defect, in this wave's `BLOCKERS.md`.
 */
export const identity: FixtureIdentity = {
  scenarioId: "C08-C",
  fixtureId: "gate-c-w3-c08-planning-closed",
  fixtureVersion: 1,
  fixtureSha256: "b602fcf6f71c03518b5adac988441afefc1acea5a296c61df83e7009e466fe31",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-11-11T14:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const { commandCentre, selectionDecisions, liveNow, projection, nowIso } = gateCW3QuickAddFacts("none");

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "C08-C", selectionDecisions };
