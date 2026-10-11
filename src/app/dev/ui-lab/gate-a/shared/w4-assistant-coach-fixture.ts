import { MATCH_W3_PENDING_STARTER_PLAYER_ID, matchW3Identity } from "./match-w3-fixture";
import type { MatchInsightCandidate } from "@/lib/matches/match-insights/types";
import type { MatchInsightsStatus } from "@/lib/matches/match-insights/get-match-insights";
import type { AssistantCoachHypothesisCardViewModel } from "./assistant-coach-hypothesis-card";

/**
 * Gate A W4 shared Assistant Coach fixture anchor (A05/A08/A10). Reuses the W3 match/player
 * identity (`player-w3-tobias`, the pending RCM starter) for fixture continuity rather than
 * inventing a second unrelated player, per the handoff bundle's `11_FIXTURE_CATALOG_AND_DATA_
 * TRUTH.md`: "Prefer reusing approved W3 fixture identity if W3 has been merged, provided the
 * facts and constraints still fit." Tobias's real W3 story (declared secondary CM, no recorded
 * minutes at RCM) is exactly the kind of "possible candidate, but sparse evidence" case A05/A10
 * need — not a coincidence, a deliberate reuse.
 */
export const W4_PLAYER_ID = MATCH_W3_PENDING_STARTER_PLAYER_ID;
export const W4_PLAYER_NAME = "Tobias";
export const W4_PLAYER_SHIRT_NUMBER = 12;
export const W4_MATCH_REFERENCE = `${matchW3Identity.homeTeam} vs ${matchW3Identity.awayTeam}`;

/** Fixed simulation clock — never `Date.now()` (`21_FIXTURE_CAPTURE_AND_AUTHORITY.md`). */
export const W4_NOW = new Date("2026-10-10T09:00:00.000Z");

/**
 * The SAME deterministic Match Insights list across every A05/A08 activation state — only the
 * AI-enrichment slice changes (`13_TEST_AND_ACCEPTANCE_MATRIX.md`: "Switching AI fresh to
 * unavailable leaves the deterministic insight IDs and ranking invariant").
 */
export const w4DeterministicInsights: MatchInsightCandidate[] = [
  {
    id: "det:slot-gap-rcm",
    category: "CURRENT_PLAN",
    relevance: "HIGH",
    title: "RCM is unfilled in the current plan",
    observation: `${W4_PLAYER_NAME} is in the matchday squad with no tactical slot assigned yet.`,
    subjectRefs: [W4_PLAYER_ID],
    factRefs: ["fact:slot-gap-rcm"],
    evidenceRefs: ["src-fact-slot-rcm-empty"],
    source: "DETERMINISTIC",
  },
  {
    id: "det:declared-secondary-cm",
    category: "PLAYER_PROFILE",
    relevance: "CONTEXTUAL",
    title: `${W4_PLAYER_NAME}'s declared secondary position is CM`,
    observation: "No recorded match minutes at a central-midfield tactical slot yet.",
    subjectRefs: [W4_PLAYER_ID],
    factRefs: ["fact:declared-secondary-cm"],
    evidenceRefs: ["src-fact-player-declared-cm"],
    confidence: "LOW",
    source: "DETERMINISTIC",
  },
];

export function w4MatchInsightsViewModel(status: MatchInsightsStatus, aiInsights: MatchInsightCandidate[] = []) {
  const insights = [...w4DeterministicInsights, ...aiInsights];
  return { status, insights, totalCount: insights.length };
}

export const w4Hypothesis: AssistantCoachHypothesisCardViewModel = {
  id: "hyp-w4-01",
  statement: `${W4_PLAYER_NAME} has shown composure in deeper midfield positions during training observations, which may translate to a central-midfield tactical slot.`,
  uncertainty: "MEDIUM",
  supportingRefs: [
    { kind: "QUALITATIVE_OBSERVATION", id: "src-obs-composure-01", label: "coach observation, 2026-10-03" },
    { kind: "HUMAN_ASSESSMENT", id: "src-assessment-declared-cm", label: "declared secondary position: CM" },
  ],
  contradictingRefs: [],
  missingEvidence: ["No recorded match minutes at a central-midfield tactical slot."],
};

export const w4AiInsightFromHypothesis: MatchInsightCandidate = {
  id: "ai:lineup-option-rcm",
  category: "OPPORTUNITY",
  relevance: "MEDIUM",
  title: `Consider ${W4_PLAYER_NAME} for the open RCM slot`,
  observation: "A declared central-midfield position makes this a possible candidate for review. Actual playing minutes at this position are not recorded.",
  subjectRefs: [W4_PLAYER_ID],
  factRefs: [],
  evidenceRefs: ["src-fact-slot-rcm-empty", "src-fact-player-declared-cm"],
  source: "AI",
};
