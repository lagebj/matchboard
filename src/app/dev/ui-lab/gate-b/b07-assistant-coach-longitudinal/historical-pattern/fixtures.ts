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
  // W4-R5/R6/R7 independent-review remediation: match-format/chronology, opponent-identity, and
  // causal-framing corrections (see SOURCE_RECONCILIATION.md) — fixtureVersion 1 -> 2.
  fixtureVersion: 2,
  fixtureSha256: "67036ef06a38d51841e430a758cb68ada51f899573e971de5534b45d4e730c3d",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: B07_HISTORICAL_REFERENCE_AT.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const matchIdentity = b07HistoricalMatchIdentity;
export const timeline = b07HistoricalTimeline;
export const sourceRecords = b07HistoricalPatternSourceRecords;

/**
 * W4-R7: reworded after review found the previous draft asserted the review's OWN causal claim
 * ("Bærum SK exploited it again") rather than attributing the mechanism strictly to the coaching
 * staff's own recorded words, and claimed "the last 2" prior matches — a completeness claim this
 * fixture's two-prior-match evidence does not establish. Every sentence below separates "when" (a
 * goal was conceded — Match data) from "why" (the coaching staff's own debrief note — Coach
 * observation), and bounds its coverage claim to "the matches included in this review," never
 * "the team's last N matches" or "every match."
 */
export const advisorViewModel: Extract<CompletedMatchAdvisorViewModel, { status: "fresh" | "stale" }> = {
  status: "fresh",
  summary:
    "The coaching staff have flagged the same defensive moment in three separate post-match debriefs over five weeks — this review surfaces that recurring note, not a new finding of its own.",
  insights: [
    {
      sectionLabel: "Supported",
      title: "Conceding after a lost throw-in on the right is a recurring debrief note",
      body:
        "In each of the two prior matches included in this review, and again in this match's own debrief, the coaching staff recorded the same concern: the back line drops too deep once a throw-in is lost on the right. A goal was conceded in each of these three matches — today at 23' — but it's the coaching staff's own debrief notes that connect these goals to a shared cause, not the timing by itself. These are the matches recorded in this review, not necessarily every match the team has played recently, so this reflects what's been noted so far, not a guarantee it recurs.",
      evidenceSources: ["Match data", "Coach observation"],
    },
    {
      sectionLabel: "Next focus",
      title: "Rehearse regaining shape after a lost throw-in on the right",
      body:
        "Given the debrief note recorded in all three of these matches, a focused session on resetting defensive shape immediately after losing a throw-in near the box could directly address a concern the coaching staff keep raising.",
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
