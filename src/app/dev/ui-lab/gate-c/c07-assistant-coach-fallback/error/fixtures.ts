import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { TodayAssistantCoachContext } from "@/lib/touchline/presentation/today-assistant-coach";
import { gateCW3DecisionDayFacts } from "../../w3-shared/fixtures";

/**
 * C07-ERROR — capability failure (register C07: simulated unavailable AI service/quota failure).
 * Reuses the real `AdvisorPanelUnavailable` component (ADR-0152 §17 "Error state") — the same
 * proportionate, non-dominating error presentation already used by Round Board/Match Insights —
 * never a page-level error, never a retry loop.
 */
export const identity: FixtureIdentity = {
  scenarioId: "C07-ERROR",
  fixtureId: "gate-c-w3-c07-error",
  fixtureVersion: 1,
  fixtureSha256: "c5cdbea80664841c52e82f1f6e7e1c4f25b7756388804ee753827781c3ce456c",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-11-11T14:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const assistantCoachContext: TodayAssistantCoachContext = { status: "unavailable" };

export const { commandCentre, selectionDecisions, liveNow, projection, nowIso } = gateCW3DecisionDayFacts();

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "C07-ERROR", assistantCoachContext };
