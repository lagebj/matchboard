import type { FixtureIdentity } from "../../shared/fixture-identity";
import type { FixtureOperationOutcome } from "../../shared/fixture-operation";
import { MATCH_W3_PENDING_STARTER_PLAYER_ID, MATCH_W3_UNFILLED_SLOT, MATCH_W3_LINEUP_REVISION, MATCH_W3_NOW_PLANNING_OPEN } from "../../shared/match-w3-fixture";
import type { LineupProposalCandidate, LineupProposalSuccess } from "../shared/lineup-proposal-editor";

/**
 * A10 "Review lineup alternative" — register row 37's primary acceptance case: a structured,
 * evidence-backed proposal for the SAME unfilled-RCM-slot gap W3's A07 already used
 * (`CURRENT_STATE_AUDIT.md` item 7). `expectedRevision` matches the current authoritative
 * revision, so Apply is genuinely available — distinct from `stale-proposal-blocked`.
 */
export const identity: FixtureIdentity = {
  scenarioId: "A10-review-alternative-success",
  fixtureId: "gate-a-w4-a10-review-alternative-success",
  fixtureVersion: 1,
  fixtureSha256: "1581c70e97e01dc1d02dbae5643ff3d0c1ee7fce3648e497a7563183537e9ff6",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: MATCH_W3_NOW_PLANNING_OPEN.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const slotLabel = MATCH_W3_UNFILLED_SLOT;
export const currentPlanRevision = MATCH_W3_LINEUP_REVISION;

export const proposal: LineupProposalCandidate = {
  proposalId: "prop-w4-a10-01",
  playerId: MATCH_W3_PENDING_STARTER_PLAYER_ID,
  displayName: "Tobias",
  shirtNumber: 12,
  evidenceRefs: ["src-fact-slot-rcm-empty", "src-fact-player-declared-cm"],
  rationale: "A declared central-midfield position makes this a possible candidate for review. Actual playing minutes at this position are not recorded.",
  limitations: ["No completed-match minutes recorded for this tactical position."],
  expectedConsequences: ["The draft would place the selected player in the currently empty RCM slot."],
};

/** Matches `currentPlanRevision` — Apply is genuinely available, not blocked. */
export const proposalExpectedRevision = MATCH_W3_LINEUP_REVISION;

export const predeclaredOutcome: FixtureOperationOutcome<LineupProposalSuccess> = {
  kind: "SUCCESS",
  revision: "lineup-rev-2-assigned",
  result: { assignedPlayerId: MATCH_W3_PENDING_STARTER_PLAYER_ID, slotLabel },
};

export const rawRecordsForHash = { slotLabel, proposal, proposalExpectedRevision, predeclaredOutcome };
