import { buildMatchFlowChronology, buildShapeChangeRows, type WhatThisMatchAddedInput } from "@/lib/matches/completed-match-story";
import type { MatchTimelineItem } from "@/lib/matches/match-detail-view-model";
import type { MatchTransition } from "@/lib/evidence/match-state-timeline";

/**
 * ADR-0157 C9 golden-state fixture data — Completed Match (`08_COMPLETED_MATCH.md`).
 * Deterministic, in-memory only; every shape is typed against the real production contracts,
 * and every rendered value flows through the same pure builders the production route uses
 * (`buildMatchFlowChronology`, `buildShapeChangeRows`, `buildWhatThisMatchAddedRows`) — no
 * fabricated momentum, no Player of the Match, no invented positions.
 */

const completedMatchTimeline: MatchTimelineItem[] = [
  { id: "p1-start", kind: "PERIOD_BOUNDARY", minuteLabel: "0′", playerName: null, assistPlayerName: null, secondaryPlayerName: null, sourceIsCanonicalLiveEvent: true },
  { id: "goal-1", kind: "GOAL_FOR", minuteLabel: "4′", playerName: "Emil Johansen", assistPlayerName: "Sindre Bakke", secondaryPlayerName: null, sourceIsCanonicalLiveEvent: true },
  { id: "goal-2", kind: "GOAL_AGAINST", minuteLabel: "11′", playerName: null, assistPlayerName: null, secondaryPlayerName: null, sourceIsCanonicalLiveEvent: true },
  { id: "p1-end", kind: "PERIOD_BOUNDARY", minuteLabel: "20′", playerName: null, assistPlayerName: null, secondaryPlayerName: null, sourceIsCanonicalLiveEvent: true },
  { id: "p2-start", kind: "PERIOD_BOUNDARY", minuteLabel: "20′", playerName: null, assistPlayerName: null, secondaryPlayerName: null, sourceIsCanonicalLiveEvent: true },
  { id: "rot-1", kind: "ROTATION", minuteLabel: "27′", playerName: "Mathias Øie", assistPlayerName: null, secondaryPlayerName: "Jonas Kvist", sourceIsCanonicalLiveEvent: true },
  { id: "goal-3", kind: "GOAL_FOR", minuteLabel: "33′", playerName: "Sindre Bakke", assistPlayerName: null, secondaryPlayerName: null, sourceIsCanonicalLiveEvent: true },
  { id: "goal-4", kind: "GOAL_FOR", minuteLabel: "38′", playerName: "Emil Johansen", assistPlayerName: "Mathias Øie", secondaryPlayerName: null, sourceIsCanonicalLiveEvent: true },
  { id: "p2-end", kind: "PERIOD_BOUNDARY", minuteLabel: "40′", playerName: null, assistPlayerName: null, secondaryPlayerName: null, sourceIsCanonicalLiveEvent: true },
  { id: "match-end", kind: "MATCH_END", minuteLabel: null, playerName: null, assistPlayerName: null, secondaryPlayerName: null, sourceIsCanonicalLiveEvent: true },
];

/** One real `MatchTransition` — a single substitution plus a CM→RB reshuffle at 27′. */
const shapeChangeTransition: MatchTransition = {
  atMs: 27 * 60_000,
  period: "SECOND_HALF",
  playersOff: ["p-jonas"],
  playersOn: ["p-mathias"],
  playersRemaining: ["p-emil", "p-sindre"],
  positionOnlyChanges: [
    { playerId: "p-emil", fromPosition: "CM", toPosition: "RB", fromLine: "MIDFIELD", toLine: "DEFENDER" },
  ],
  substitutionCount: 1,
  changedLines: ["MIDFIELD", "DEFENDER"],
  isSimultaneousSubstitutionAndReshuffle: false,
  disruptionDescriptors: [],
  scoreBefore: { for: 1, against: 1 },
  scoreAfter: { for: 2, against: 1 },
  isAtNaturalBreak: false,
};

const nameByPlayerId = new Map<string, string>([
  ["p-emil", "Emil Johansen"],
  ["p-sindre", "Sindre Bakke"],
  ["p-mathias", "Mathias Øie"],
  ["p-jonas", "Jonas Kvist"],
]);

export const completedMatchFixture = {
  ownTeamName: "Rød",
  opponentName: "Sætre Lions",
  finalScore: "4–1",
  timeline: completedMatchTimeline,
  matchFlow: buildMatchFlowChronology(completedMatchTimeline),
  shapeChangeRows: buildShapeChangeRows([shapeChangeTransition], nameByPlayerId),
  whatThisMatchAddedInput: {
    hasNewObservations: true,
    observationCount: 2,
    hasNewOpponentEncounter: true,
    opponentName: "Sætre Lions",
    firstTimeCanonicalPositions: [
      { playerId: "p-mathias", playerName: "Mathias Øie", position: "CM" },
      { playerId: "p-jonas", playerName: "Jonas Kvist", position: "LB" },
    ],
  } satisfies WhatThisMatchAddedInput,
};