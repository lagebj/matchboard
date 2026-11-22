import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { TodayAssistantCoachContext } from "@/lib/touchline/presentation/today-assistant-coach";
import { gateCW3DecisionDayFacts } from "../../w3-shared/fixtures";

/**
 * C07-EMPTY — capability available but no relevant hypothesis (register C07). No generic AI
 * advice is manufactured to fill the space; the panel renders nothing, identical to C07-OFF's
 * layout, but for a different underlying reason (capability enabled, nothing material to show —
 * disclosed in this wave's `BLOCKERS.md`/`SCENARIO_REGISTER.md`, not distinguishable in the
 * rendered output itself, by design).
 */
export const identity: FixtureIdentity = {
  scenarioId: "C07-EMPTY",
  fixtureId: "gate-c-w3-c07-empty",
  fixtureVersion: 1,
  fixtureSha256: "745c8bfcb94692362c7ba51c93493d381cb407c1325cb03c8c3e38f1db1aac41",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-11-11T14:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const assistantCoachContext: TodayAssistantCoachContext = { status: "empty" };

export const { commandCentre, selectionDecisions, liveNow, projection, nowIso } = gateCW3DecisionDayFacts();

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "C07-EMPTY", assistantCoachContext };
