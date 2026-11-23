import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import { gateCW3QuickAddFacts } from "../../w3-shared/fixtures";

/**
 * C08-A — Planning open (register C08: "Planning open"). The real, already-shipped Today quick-
 * add (`applyTodaySelectionRecommendationAction` -> `addPlayerToDraftMatch`) offers a genuine
 * one-click "Add" action. Display-only here; the real mutation, persistence, and cross-surface
 * revalidation are exercised by the real-DB integration test
 * "applies the mutation and revalidates Today/Round Board/Fixtures when the fingerprint matches
 * current state" in `src/app/(app)/o/[orgSlug]/today/__tests__/actions.test.ts` — not a browser
 * test; see `docs/ui-lab/gate-c-w3-candidates/BLOCKERS.md` for why a genuine authenticated
 * browser-level quick-add journey is not available in this wave.
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
