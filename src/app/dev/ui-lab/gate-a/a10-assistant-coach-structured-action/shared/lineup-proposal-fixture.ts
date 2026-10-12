import { MATCH_W3_ID, MATCH_W3_GROUP_ID, MATCH_W3_PENDING_STARTER_PLAYER_ID, MATCH_W3_UNFILLED_SLOT, MATCH_W3_LINEUP_REVISION, matchW3Squad, matchW3PlanningPitchAssignments } from "../../shared/match-w3-fixture";
import type { LineupProposalEvidenceSource, LineupProposalValidationContext } from "./lineup-proposal-contract";

/**
 * Shared A10 validation-context fixture — every scenario's `fixtures.ts` builds its own
 * `LineupSlotAssignmentProposal` and `expectedRevision`, but the scope/roster/slot/evidence facts
 * a proposal is validated against are the SAME underlying W3 match anchor, so they live here once
 * rather than being re-declared (and risking drift) in each scenario file.
 *
 * Third review round: `ASSIGN_PLAYER_TO_LINEUP_SLOT` supports assignment into an EMPTY tactical
 * slot only (finding F1) — `A10_SLOT_OCCUPANTS` is exactly the authoritative occupancy map
 * `validateLineupProposal` checks a proposal's target slot against, so an occupied-slot replacement
 * is rejected (`TARGET_SLOT_OCCUPIED`) rather than silently accepted. Occupied-slot replacement,
 * swapping, or moving a displaced player elsewhere are NOT implemented or approved — see
 * `BLOCKERS.md`. The evidence catalog below also now marks which sources are slot-specific via an
 * explicit `slotId` (finding F2), so evidence about one slot's occupancy can never be cited to
 * support a proposal targeting a different slot.
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

/** Every real slot id this match's formation defines, each mapped to `null` (unfilled) by
 * default — occupied slots are filled in below from the SAME `matchW3PlanningPitchAssignments`
 * projection the editor renders the pitch from, never a second independently authored list
 * (second review round finding N1: a single `currentSlotPlayerId` field previously let a proposal
 * targeting ANY slot validate against one hardcoded slot's — RCM's — empty state). */
export const A10_VALID_SLOT_IDS: ReadonlySet<string> = new Set(["slot-GK", "slot-LCB", "slot-RCB", "slot-LCM", "slot-CM", "slot-RCM", "slot-CF"]);

function buildSlotOccupants(): ReadonlyMap<string, string | null> {
  const occupants = new Map<string, string | null>([...A10_VALID_SLOT_IDS].map((slotId) => [slotId, null]));
  for (const assignment of matchW3PlanningPitchAssignments()) {
    if (occupants.has(assignment.slotId)) occupants.set(assignment.slotId, assignment.playerId);
  }
  return occupants;
}

/** The real authoritative starting projection: Oskar at `slot-GK`, Theodor at `slot-LCB`, Markus
 * at `slot-RCB`, Sindre at `slot-LCM`, Kasper at `slot-CM`, Noah at `slot-CF`, `slot-RCM` unfilled
 * — exactly `matchW3Squad`'s own real assignments, not a re-authored copy. */
export const A10_SLOT_OCCUPANTS: ReadonlyMap<string, string | null> = buildSlotOccupants();

export const A10_EVIDENCE_CATALOG: readonly LineupProposalEvidenceSource[] = [
  {
    sourceId: "src-fact-slot-rcm-empty",
    matchId: A10_MATCH_ID,
    groupId: A10_GROUP_ID,
    playerId: null,
    // F2: this source's claim IS a specific slot's occupancy — it must only ever support a
    // proposal that actually targets slot-RCM, never be cited to establish some other slot's state.
    slotId: "slot-RCM",
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
    // No slotId: a declared secondary position is player-profile evidence, not tied to any one
    // tactical slot — it remains valid support for a proposal targeting any slot that position
    // covers, as long as its player/scope relationships check out (F2's own requirement).
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
    // Explicitly scoped to RCM — it measures the player's recorded minutes AT that exact slot,
    // so (unlike the declared-position fact above) it must not be cited for a different slot.
    slotId: "slot-RCM",
    kind: "DEVELOPMENT_EVIDENCE",
    fieldLabel: "Recorded minutes at RCM",
    fieldValue: "Not recorded",
    coverage: "NOT_RECORDED",
    supports: "Discloses the proposal's own limitation — no completed-match minutes at this exact tactical slot.",
  },
  // Deliberately wrong-slot evidence — never cited by any real A10 proposal, only by the negative
  // fixture test proving slot-specific evidence cannot support a proposal targeting a different
  // tactical slot (independent review round 3, finding F2).
  {
    sourceId: "src-fact-slot-gk-occupied",
    matchId: A10_MATCH_ID,
    groupId: A10_GROUP_ID,
    playerId: null,
    slotId: "slot-GK",
    kind: "RECORDED_MATCH",
    fieldLabel: "GK slot occupant",
    fieldValue: "Oskar",
    coverage: "COMPLETE",
    supports: "Negative-fixture-only: concerns a different tactical slot than the one being proposed.",
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
  // Deliberately wrong-subject evidence — never cited by any real A10 proposal, only by the
  // negative fixture test proving player-specific evidence about an unrelated player is rejected.
  {
    sourceId: "src-fact-other-player-evidence",
    matchId: A10_MATCH_ID,
    groupId: A10_GROUP_ID,
    playerId: "player-w3-sindre",
    kind: "COACH_DECLARED",
    fieldLabel: "Declared secondary position",
    fieldValue: "CM",
    coverage: "COMPLETE",
    supports: "Negative-fixture-only: concerns a different player than the one being proposed.",
  },
];

export function a10ValidationContext(overrides: Partial<LineupProposalValidationContext> = {}): LineupProposalValidationContext {
  return {
    matchId: A10_MATCH_ID,
    groupId: A10_GROUP_ID,
    currentRevision: A10_CURRENT_REVISION,
    knownPlayerIds: A10_KNOWN_PLAYER_IDS,
    rosterPlayerIds: A10_ROSTER_PLAYER_IDS,
    slotOccupants: A10_SLOT_OCCUPANTS,
    evidenceCatalog: A10_EVIDENCE_CATALOG,
    ...overrides,
  };
}
