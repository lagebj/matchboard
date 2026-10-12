import {
  MATCH_W3_ID,
  MATCH_W3_GROUP_ID,
  MATCH_W3_PENDING_STARTER_PLAYER_ID,
  MATCH_W3_UNFILLED_SLOT,
  MATCH_W3_LINEUP_REVISION,
  matchW3Squad,
} from "../../shared/match-w3-fixture";
import type { LineupProposalEvidenceSource, LineupProposalValidationContext } from "./lineup-proposal-contract";

/**
 * Shared A10 validation-context fixture — every scenario's `fixtures.ts` builds its own
 * `LineupSlotAssignmentProposal` and `expectedRevision`, but the scope/roster/slot/evidence facts
 * a proposal is validated against are the SAME underlying W3 match anchor, so they live here once
 * rather than being re-declared (and risking drift) in each scenario file.
 */
export const A10_MATCH_ID = MATCH_W3_ID;
export const A10_GROUP_ID = MATCH_W3_GROUP_ID;
export const A10_TARGET_SLOT_ID = `slot-${MATCH_W3_UNFILLED_SLOT}`;
export const A10_CURRENT_REVISION = MATCH_W3_LINEUP_REVISION;

/** Every player id that exists in this fixture universe at all — a superset of the match roster,
 * so "unknown player" and "known player, wrong roster" are distinguishable rejection codes. */
export const A10_KNOWN_PLAYER_IDS: ReadonlySet<string> = new Set([
  ...matchW3Squad.map((m) => m.playerId),
  "player-w4-not-in-any-roster", // exists in the fixture universe, deliberately not in match-w3-01's squad
]);

export const A10_ROSTER_PLAYER_IDS: ReadonlySet<string> = new Set(matchW3Squad.map((m) => m.playerId));

export const A10_VALID_SLOT_IDS: ReadonlySet<string> = new Set(["slot-GK", "slot-LCB", "slot-RCB", "slot-LCM", "slot-CM", "slot-RCM", "slot-CF"]);

/** The RCM slot is currently unfilled in every A10 scenario's starting authoritative projection. */
export const A10_CURRENT_SLOT_PLAYER_ID: string | null = null;

export const A10_EVIDENCE_CATALOG: readonly LineupProposalEvidenceSource[] = [
  {
    sourceId: "src-fact-slot-rcm-empty",
    matchId: A10_MATCH_ID,
    groupId: A10_GROUP_ID,
    playerId: null,
    kind: "RECORDED_MATCH",
    fieldLabel: "RCM slot occupant",
    fieldValue: "None — unfilled",
    coverage: "COMPLETE",
    supports: "Confirms the target slot is genuinely open before any assignment is proposed.",
  },
  {
    sourceId: "src-fact-player-declared-cm",
    matchId: A10_MATCH_ID,
    groupId: A10_GROUP_ID,
    playerId: MATCH_W3_PENDING_STARTER_PLAYER_ID,
    kind: "COACH_DECLARED",
    fieldLabel: "Declared secondary position",
    fieldValue: "CM",
    coverage: "COMPLETE",
    supports: "Positional eligibility — a declared central-midfield position.",
  },
  {
    sourceId: "src-fact-player-exposure-rcm",
    matchId: A10_MATCH_ID,
    groupId: A10_GROUP_ID,
    playerId: MATCH_W3_PENDING_STARTER_PLAYER_ID,
    kind: "DEVELOPMENT_EVIDENCE",
    fieldLabel: "Recorded minutes at RCM",
    fieldValue: "Not recorded",
    coverage: "NOT_RECORDED",
    supports: "Discloses the proposal's own limitation — no completed-match minutes at this exact tactical slot.",
  },
  // Deliberately wrong-scope evidence — never cited by any real A10 proposal, only by the negative
  // fixture tests proving a cross-match/cross-group evidence ref is rejected.
  {
    sourceId: "src-fact-other-match-evidence",
    matchId: "match-w4-other-01",
    groupId: "group-w4-other-01",
    playerId: null,
    kind: "RECORDED_MATCH",
    fieldLabel: "RCM slot occupant",
    fieldValue: "Someone else",
    coverage: "COMPLETE",
    supports: "Negative-fixture-only: belongs to a different match/group entirely.",
  },
];

export function a10ValidationContext(overrides: Partial<LineupProposalValidationContext> = {}): LineupProposalValidationContext {
  return {
    matchId: A10_MATCH_ID,
    groupId: A10_GROUP_ID,
    currentRevision: A10_CURRENT_REVISION,
    knownPlayerIds: A10_KNOWN_PLAYER_IDS,
    rosterPlayerIds: A10_ROSTER_PLAYER_IDS,
    validSlotIds: A10_VALID_SLOT_IDS,
    currentSlotPlayerId: A10_CURRENT_SLOT_PLAYER_ID,
    evidenceCatalog: A10_EVIDENCE_CATALOG,
    ...overrides,
  };
}
