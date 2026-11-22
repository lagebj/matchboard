import type { FixtureIdentity } from "@/app/dev/ui-lab/gate-a/shared/fixture-identity";
import type { AssistantCoachHypothesisViewModel } from "@/components/ai/assistant-coach-hypothesis-panel";
import type { TodayAssistantCoachContext } from "@/lib/touchline/presentation/today-assistant-coach";
import { gateCW3DecisionDayFacts } from "../../w3-shared/fixtures";

/**
 * C07-ON — material contextual synthesis (register C07: "capability ON"). Identical underlying
 * Today facts to C07-OFF — only `assistantCoachContext` differs, so an OFF/ON comparison is
 * apples-to-apples. The hypothesis is deliberately not a restatement of anything Today already
 * shows: it synthesizes a season-wide opportunity pattern (not present elsewhere on Today) with
 * the current round, and names its own evidence and missing evidence explicitly, per ADR-0157
 * §2's knowledge-hierarchy class 4 ("never truth by itself").
 */
export const identity: FixtureIdentity = {
  scenarioId: "C07-ON",
  fixtureId: "gate-c-w3-c07-on",
  fixtureVersion: 1,
  fixtureSha256: "d7cef025dc273645d17d860ad62afc9078093443fd282920ac6544a5d6cdb810",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: "2026-11-11T14:00:00.000Z",
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const alexOpportunityHypothesis: AssistantCoachHypothesisViewModel = {
  id: "gate-c-w3-c07-hypothesis-alex-opportunity",
  statement:
    "Alex Dahl has received fewer match opportunities than comparable eligible teammates this season. Round 9 — where Alex is currently unassigned — looks like a plausible development opportunity.",
  uncertainty: "MEDIUM",
  supportingRefs: [
    { kind: "DERIVED_TREND", id: "trend-alex-opportunity-rate", label: "Opportunity rate, Rounds 1-8 vs comparable teammates" },
    { kind: "MATCH_CONTEXT", id: "round-c07-1-context", label: "Round 9 squad composition" },
  ],
  contradictingRefs: [],
  missingEvidence: ["Recent training attendance"],
};

export const assistantCoachContext: TodayAssistantCoachContext = {
  status: "fresh",
  hypotheses: [alexOpportunityHypothesis],
};

export const { commandCentre, selectionDecisions, liveNow, projection, nowIso } = gateCW3DecisionDayFacts();

/** The exact raw record `identity.fixtureSha256` is a hash of — tests recompute, never copy. */
export const rawRecordsForHash = { scenario: "C07-ON", alexOpportunityHypothesis };
