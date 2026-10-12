import type { FixtureIdentity } from "../../shared/fixture-identity";
import type { FixtureOperationOutcome } from "../../shared/fixture-operation";
import { MATCH_W3_PENDING_STARTER_PLAYER_ID, MATCH_W3_UNFILLED_SLOT, MATCH_W3_NOW_PLANNING_OPEN } from "../../shared/match-w3-fixture";
import type { LineupProposalSuccess } from "../shared/lineup-proposal-editor";
import type { LineupSlotAssignmentProposal } from "../shared/lineup-proposal-contract";
import { validateLineupProposal, resolveProposalEvidence } from "../shared/lineup-proposal-contract";
import { a10ValidationContext, A10_MATCH_ID, A10_GROUP_ID, A10_TARGET_SLOT_ID, A10_CURRENT_REVISION, A10_EVIDENCE_CATALOG } from "../shared/lineup-proposal-fixture";

/**
 * A10 "Review lineup alternative" — register row 37's primary acceptance case: a structured,
 * contract-validated proposal for the SAME unfilled-RCM-slot gap W3's A07 already used
 * (`CURRENT_STATE_AUDIT.md` item 7). `expectedRevision` matches `A10_CURRENT_REVISION`, so Apply
 * is genuinely available — distinct from `stale-proposal-blocked`.
 */
export const identity: FixtureIdentity = {
  scenarioId: "A10-review-alternative-success",
  fixtureId: "gate-a-w4-a10-review-alternative-success",
  fixtureVersion: 2,
  fixtureSha256: "487f25dc43002dd41c52a83f613169ed9a64fb9910ba992a9b9fc86f42d09d44",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: MATCH_W3_NOW_PLANNING_OPEN.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const slotLabel = MATCH_W3_UNFILLED_SLOT;

export const proposal: LineupSlotAssignmentProposal = {
  proposalId: "prop-w4-a10-01",
  insightId: "ai:lineup-option-rcm",
  proposalKind: "ASSIGN_PLAYER_TO_LINEUP_SLOT",
  proposedBy: "AI",
  matchId: A10_MATCH_ID,
  groupId: A10_GROUP_ID,
  expectedRevision: A10_CURRENT_REVISION,
  slotId: A10_TARGET_SLOT_ID,
  playerId: MATCH_W3_PENDING_STARTER_PLAYER_ID,
  before: { playerId: null },
  after: { playerId: MATCH_W3_PENDING_STARTER_PLAYER_ID },
  evidenceRefs: ["src-fact-slot-rcm-empty", "src-fact-player-declared-cm", "src-fact-player-exposure-rcm"],
  rationale: "A declared central-midfield position makes this a possible candidate for review. Actual playing minutes at this position are not recorded.",
  limitations: ["No completed-match minutes recorded for this tactical position."],
  expectedConsequences: ["The draft would place the selected player in the currently empty RCM slot."],
};

/** Validated at module load — "reject before render": a fixture whose own proposal fails
 * validation must fail loudly here, never silently render as if it were actionable. */
const validation = validateLineupProposal(proposal, a10ValidationContext());
if (!validation.valid) {
  throw new Error(`A10 review-alternative-success fixture's own proposal failed validation: ${validation.code} — ${validation.reason}`);
}
if (validation.applicability !== "APPLICABLE") {
  throw new Error(`A10 review-alternative-success fixture's proposal must be APPLICABLE, got ${validation.applicability}`);
}
export const proposalValidation = validation;
export const evidence = resolveProposalEvidence(proposal, A10_EVIDENCE_CATALOG);

export const predeclaredOutcome: FixtureOperationOutcome<LineupProposalSuccess> = {
  kind: "SUCCESS",
  revision: "lineup-rev-2-assigned",
  result: { assignedPlayerId: MATCH_W3_PENDING_STARTER_PLAYER_ID, slotLabel },
};

export const rawRecordsForHash = { slotLabel, proposal, predeclaredOutcome };
