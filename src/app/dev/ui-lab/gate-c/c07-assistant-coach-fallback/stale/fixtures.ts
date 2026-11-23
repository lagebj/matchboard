import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { TodayAssistantCoachContext } from "@/lib/touchline/presentation/today-assistant-coach";
import { gateCW3DecisionDayFacts } from "../../w3-shared/fixtures";

/**
 * C07-STALE — outdated context (register C07: "a hypothesis generated from an older player or
 * match state"). Reuses the real, already-shipped freshness/fingerprint fallback component
 * (`AdvisorPanelStale`, the same one Round Board's `getRoundBoardAdvisorViewModel()` falls back
 * to on a `sourceFingerprint` mismatch) rather than inventing a new staleness mechanism.
 */
export const identity: FixtureIdentity = {
  scenarioId: "C07-STALE",
  fixtureId: "gate-c-w3-c07-stale",
  fixtureVersion: 1,
  fixtureSha256: "557e8f424c04c5d75095cbcf065699785ae2b5a47ac82822bea084ece24a5420",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-11-11T14:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const assistantCoachContext: TodayAssistantCoachContext = { status: "stale" };

export const { commandCentre, selectionDecisions, liveNow, projection, nowIso } = gateCW3DecisionDayFacts();

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "C07-STALE", assistantCoachContext };
