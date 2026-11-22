import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import { gateCW3QuickAddFacts } from "../../w3-shared/fixtures";

/**
 * C08-B — "After RSVP" (register C08). Matchboard has no automated RSVP-deadline mechanism
 * (`PlannedAbsenceReason.NO_RSVP` is a manually-selected category, not a computed deadline — see
 * Gate A's A09 `BLOCKERS.md` for the same disclosure). This scenario is built against the real
 * mechanism that actually exists: a `TENTATIVE` `Player.currentAvailability`, with planning still
 * open.
 *
 * Confirmed against the real planner (`today-selection-recommendation-plan.ts`, proven live in
 * `today/__tests__/actions.test.ts`): a tentative player still produces a real
 * `AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY` decision (the plan-integrity rule treats
 * TENTATIVE as available), but the recommendation itself intentionally withholds the one-click
 * action — `directlyActionable: false` with the exact real `unavailableReason` string, never a
 * UI-invented one — showing the same degraded "Review on the Round Board" fallback C08-C uses,
 * but for a different, correctly-distinguished reason (never the planning-closed message).
 */
export const identity: FixtureIdentity = {
  scenarioId: "C08-B",
  fixtureId: "gate-c-w3-c08-after-availability-change",
  fixtureVersion: 1,
  fixtureSha256: "d57d48419f59aa1e920cf48ab1140176bf15da3860bf85ce7690bd73acaff2f1",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-11-11T14:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const { commandCentre, selectionDecisions, liveNow, projection, nowIso } = gateCW3QuickAddFacts("tentative");

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "C08-B", selectionDecisions };
