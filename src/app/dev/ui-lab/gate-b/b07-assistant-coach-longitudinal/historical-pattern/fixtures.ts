import type { FixtureIdentity } from "../../../gate-a/shared/fixture-identity";
import {
  b07HistoricalMatchIdentity,
  b07HistoricalTimeline,
  b07HistoricalPatternSourceRecords,
  B07_HISTORICAL_REFERENCE_AT,
  B07_HISTORICAL_DEBRIEF_NOTE,
} from "../../shared/match-b-fixture";
import type { CompletedMatchAdvisorViewModel } from "@/lib/ai/presentation/completed-match-advisor";

/**
 * B07-A "Historical pattern" (official Gate B register row B07): a genuinely cross-match,
 * multi-source Assistant Coach interpretation — a defensive-shape concern recorded in two prior
 * locked matches' debriefs, raised a third time in this match's own debrief. The two
 * `evidenceSources` on the primary insight ("Match data" + "Coach observation") are deliberately
 * distinct categories: the timed canonical goal-against events anchor *when*, the coaching
 * staff's own recorded words carry *why* — this fixture never asserts the causal account itself,
 * only that the coaching staff have recorded it three times.
 */
export const identity: FixtureIdentity = {
  scenarioId: "B07-HISTORICAL-PATTERN",
  fixtureId: "gate-b-w4-b07-historical-pattern",
  fixtureVersion: 1,
  fixtureSha256: "42724b1f8e5748759114b1720a3998a8ba5b1d2c4b7393965dff504bbbd1f922",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: B07_HISTORICAL_REFERENCE_AT.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const matchIdentity = b07HistoricalMatchIdentity;
export const timeline = b07HistoricalTimeline;
export const sourceRecords = b07HistoricalPatternSourceRecords;

export const advisorViewModel: Extract<CompletedMatchAdvisorViewModel, { status: "fresh" | "stale" }> = {
  status: "fresh",
  summary:
    "Across the last three matches, the coaching staff have repeatedly flagged the same defensive moment — this match is the clearest evidence yet that it's a pattern worth addressing, not a one-off.",
  insights: [
    {
      sectionLabel: "Supported",
      title: "Conceding after a lost throw-in on the right is a recurring concern",
      body:
        "This is the third match in five weeks where the coaching staff have flagged the same issue in their post-match debrief: the back line drops too deep once a throw-in is lost on the right, and Bærum SK exploited it again today (23'). It's recorded in 2 of the last 2 prior completed matches' debriefs, plus this match's own — a recurring theme the staff have named three times, not a pattern this review has inferred from the goals alone. Not every match this team has played raised it, so this reflects the matches recorded so far, not a guarantee it recurs again.",
      evidenceSources: ["Match data", "Coach observation"],
    },
    {
      sectionLabel: "Next focus",
      title: "Rehearse regaining shape after a lost throw-in on the right",
      body:
        "Given the recurring debrief note across three matches, a focused session on resetting defensive shape immediately after losing a throw-in near the box could directly address a pattern the coaching staff keep raising.",
      evidenceSources: ["Coach observation"],
    },
  ],
  clarification: null,
  suggestions: [],
};

export const rawRecordsForHash = {
  matchIdentity,
  timeline,
  sourceRecords,
  advisorViewModel,
  historicalDebriefNote: B07_HISTORICAL_DEBRIEF_NOTE,
};
