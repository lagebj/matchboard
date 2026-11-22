import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import { gateCW3QuickAddFacts } from "../../w3-shared/fixtures";

/**
 * C08-A — Planning open (register C08: "Planning open"). The real, already-shipped Today quick-
 * add (`applyTodaySelectionRecommendationAction` -> `addPlayerToDraftMatch`) offers a genuine
 * one-click "Add" action. Display-only here; the real mutation is exercised by
 * `e2e/gate-c-w3-today-quick-add.spec.ts` against a seeded match.
 */
export const identity: FixtureIdentity = {
  scenarioId: "C08-A",
  fixtureId: "gate-c-w3-c08-planning-open",
  fixtureVersion: 1,
  fixtureSha256: "665129095156ad3a8346ccb44af3de8bacfe545355e948e39ab9f7381915c9c5",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-11-11T14:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const { commandCentre, selectionDecisions, liveNow, projection, nowIso } = gateCW3QuickAddFacts("open");

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "C08-A", selectionDecisions };
