import type { FixtureIdentity } from "../../../gate-a/shared/fixture-identity";
import { b07TrivialMatchIdentity, b07TrivialTimeline, B07_TRIVIAL_KICKOFF_AT } from "../../shared/match-b-fixture";
import type { CompletedMatchAdvisorViewModel } from "@/lib/ai/presentation/completed-match-advisor";

/**
 * B07-B "Trivial fact" (official Gate B register row B07): a clearly recorded hat-trick, shown
 * correctly in the factual Match story below, with the Assistant Coach layer explicitly declining
 * to repackage it as a longitudinal "discovery." `insights: []` and the real
 * `CompletedMatchAdvisorPanel`'s own insight-list gate (`viewModel.insights.length > 0`) means the
 * three-goal contribution is never mentioned in the Advisor section at all — it stays exactly
 * where it belongs, in the factual timeline and key figures.
 */
export const identity: FixtureIdentity = {
  scenarioId: "B07-TRIVIAL-FACT",
  fixtureId: "gate-b-w4-b07-trivial-fact",
  fixtureVersion: 1,
  fixtureSha256: "0cb0020dfce269072cc08e54a84fb392df49091641b6ed39f0db9b6ee1534af0",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: B07_TRIVIAL_KICKOFF_AT.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const matchIdentity = b07TrivialMatchIdentity;
export const timeline = b07TrivialTimeline;

export const advisorViewModel: Extract<CompletedMatchAdvisorViewModel, { status: "fresh" | "stale" }> = {
  status: "fresh",
  summary: "No historical pattern identified from the available evidence.",
  insights: [],
  clarification: null,
  suggestions: [],
};

export const rawRecordsForHash = {
  matchIdentity,
  timeline,
  advisorViewModel,
};
