import type { FixtureIdentity } from "../../shared/fixture-identity";
import { MATCH_W3_PENDING_STARTER_PLAYER_ID, MATCH_W3_UNFILLED_SLOT, MATCH_W3_NOW_PLANNING_OPEN } from "../../shared/match-w3-fixture";
import type { ProposalBlockedReason } from "../shared/lineup-proposal-editor";
import type { LineupSlotAssignmentProposal } from "../shared/lineup-proposal-contract";
import { validateLineupProposal, resolveProposalEvidence } from "../shared/lineup-proposal-contract";
import { a10ValidationContext, A10_MATCH_ID, A10_GROUP_ID, A10_TARGET_SLOT_ID, A10_EVIDENCE_CATALOG } from "../shared/lineup-proposal-fixture";

/**
 * A10 "stale proposal" — register row 37's second named case. The proposal's `expectedRevision`
 * (`lineup-rev-2`) does not match `A10_CURRENT_REVISION` (`lineup-rev-1`) — same concurrent-
 * revision pattern W3's A07-server-conflict reuses. `validateLineupProposal` itself returns
 * `applicability: "STALE"` for this, never a structural rejection: the coach may still inspect the
 * proposal's evidence/rationale, but no Apply affordance may render — enforced by the editor
 * reading `applicability`, not by hiding the proposal data.
 */
export const identity: FixtureIdentity = {
  scenarioId: "A10-stale-proposal-blocked",
  fixtureId: "gate-a-w4-a10-stale-proposal-blocked",
  fixtureVersion: 2,
  fixtureSha256: "cd0356948708110966bb9bc46509b06e1dbe83da901646a8cd70cd1f0f27ff27",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: MATCH_W3_NOW_PLANNING_OPEN.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const slotLabel = MATCH_W3_UNFILLED_SLOT;
const STALE_EXPECTED_REVISION = "lineup-rev-2";

export const proposal: LineupSlotAssignmentProposal = {
  proposalId: "prop-w4-a10-02",
  insightId: "ai:lineup-option-rcm",
  proposalKind: "ASSIGN_PLAYER_TO_LINEUP_SLOT",
  proposedBy: "AI",
  matchId: A10_MATCH_ID,
  groupId: A10_GROUP_ID,
  expectedRevision: STALE_EXPECTED_REVISION,
  slotId: A10_TARGET_SLOT_ID,
  playerId: MATCH_W3_PENDING_STARTER_PLAYER_ID,
  before: { playerId: null },
  after: { playerId: MATCH_W3_PENDING_STARTER_PLAYER_ID },
  evidenceRefs: ["src-fact-slot-rcm-empty", "src-fact-player-declared-cm", "src-fact-player-exposure-rcm"],
  rationale: "A declared central-midfield position makes this a possible candidate for review. Actual playing minutes at this position are not recorded.",
  limitations: ["No completed-match minutes recorded for this tactical position."],
  expectedConsequences: ["The draft would place the selected player in the currently empty RCM slot."],
};

const validation = validateLineupProposal(proposal, a10ValidationContext());
if (!validation.valid) {
  throw new Error(`A10 stale-proposal-blocked fixture's own proposal failed validation: ${validation.code} — ${validation.reason}`);
}
if (validation.applicability !== "STALE") {
  throw new Error(`A10 stale-proposal-blocked fixture's proposal must validate as STALE, got ${validation.applicability}`);
}
export const proposalValidation = validation;
export const evidence = resolveProposalEvidence(proposal, A10_EVIDENCE_CATALOG);

export const blockedReason: ProposalBlockedReason = {
  kind: "STALE",
  message: `The match plan changed after this proposal was generated (expected revision ${validation.expectedRevision}, current revision ${validation.currentRevision}). Ask Assistant Coach to review again before applying.`,
};

export const rawRecordsForHash = { slotLabel, proposal, blockedReason };
