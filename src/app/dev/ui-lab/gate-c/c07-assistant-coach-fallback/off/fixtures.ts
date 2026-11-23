import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { TodayAssistantCoachContext } from "@/lib/touchline/presentation/today-assistant-coach";
import { gateCW3DecisionDayFacts } from "../../w3-shared/fixtures";

/**
 * C07-OFF — Assistant Coach capability unavailable (register C07: "capability OFF"). The
 * baseline: a genuine decision-day Today with the capability simply disabled. No empty AI panel,
 * no loading placeholder, no capability-related error — Today's existing composition is
 * byte-for-byte what C07-ON below also starts from, so the only difference between the two
 * scenarios is `assistantCoachContext`.
 */
export const identity: FixtureIdentity = {
  scenarioId: "C07-OFF",
  fixtureId: "gate-c-w3-c07-off",
  fixtureVersion: 1,
  fixtureSha256: "2af912ed7818d41df83980160d2619f016c6bd44679f12afa2356b26b18889c5",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-11-11T14:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const assistantCoachContext: TodayAssistantCoachContext = { status: "off" };

export const { commandCentre, selectionDecisions, liveNow, projection, nowIso } = gateCW3DecisionDayFacts();

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "C07-OFF", assistantCoachContext };
