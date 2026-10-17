import type { FixtureIdentity } from "../../gate-a/shared/fixture-identity";
import type { FixtureOperationOutcome } from "../../gate-a/shared/fixture-operation";
import type { LineupAssignmentSuccess } from "../../gate-a/a07-match-details-edit-lineup/shared/lineup-slot-editor";
import { b01MatchIdentity, b01Squad, b01OpponentMemory, B01_EDIT_SLOT, B01_EDIT_CANDIDATE, B01_NOW } from "../shared/match-b-fixture";
import type { MatchPreparationInput } from "@/lib/matches/match-detail-view-model";
import type { MatchInsightsViewModel } from "@/lib/matches/match-insights/get-match-insights";

/**
 * B01 "Before match planned / Preparation ready" (official Gate B register, `25_OFFICIAL_GOLDEN_
 * WAVE_REGISTER.csv`): stable match identity, kickoff/plan/opponent/task priority, Edit Lineup
 * opens the local tactical editor (XR-I01), no separate lineup route. Reuses the already-shipped
 * ADR-0157 C3 composition order (identity, opponent memory, ranked Match Insights, current plan)
 * via fixture-fed real components — see SOURCE_RECONCILIATION.md for why this candidate confirms
 * rather than redesigns that order.
 */
export const identity: FixtureIdentity = {
  scenarioId: "B01",
  fixtureId: "gate-b-w1-b01-planned-ready",
  fixtureVersion: 1,
  fixtureSha256: "5d003fc1aaec0189307f20255183d7870ff1b2bc79390b3313b06a8598529213",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: B01_NOW.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const matchIdentity = b01MatchIdentity;
export const squad = b01Squad;
export const opponentMemory = b01OpponentMemory;

export const preparationInput: MatchPreparationInput = {
  squadSelectedCount: 8,
  squadTarget: 8,
  hasLineup: true,
  hasPlannedRotation: true,
};

export const matchInsights: MatchInsightsViewModel = {
  status: "CURRENT",
  totalCount: 2,
  insights: [
    {
      id: "insight-gb1-1",
      category: "OPPONENT_HISTORY",
      relevance: "HIGH",
      title: `${B01_EDIT_CANDIDATE.displayName} has started every recorded meeting with this opponent`,
      observation: "Recorded in both of the last two encounters, both as a starter.",
      implication: "Worth confirming the same role again for this match.",
      subjectRefs: [B01_EDIT_CANDIDATE.playerId],
      factRefs: ["fact-starting-pattern-vetle"],
      evidenceRefs: ["fact-starting-pattern-vetle", "fact-opponent-encounter-1", "fact-opponent-encounter-2"],
      confidence: "MEDIUM",
      source: "DETERMINISTIC",
    },
    {
      id: "insight-gb1-2",
      category: "CURRENT_PLAN",
      relevance: "MEDIUM",
      title: "RCM slot is filled by a player with limited minutes at that position",
      observation: "Tobias has 2 recorded appearances at RCM this season, both under 30 minutes.",
      subjectRefs: ["player-gb-tobias"],
      factRefs: ["fact-position-exposure-tobias"],
      evidenceRefs: ["fact-position-exposure-tobias"],
      confidence: "LOW",
      source: "DETERMINISTIC",
    },
  ],
};

export const editSlotLabel = B01_EDIT_SLOT;
export const editCandidate = B01_EDIT_CANDIDATE;

export const predeclaredOutcome: FixtureOperationOutcome<LineupAssignmentSuccess> = {
  kind: "SUCCESS",
  revision: "gate-b-w1-b01-lineup-rev-2",
  result: { assignedPlayerId: B01_EDIT_CANDIDATE.playerId, slotLabel: editSlotLabel },
};

export const rawRecordsForHash = { matchIdentity, squad, opponentMemory, preparationInput, matchInsights, editCandidate, predeclaredOutcome };
