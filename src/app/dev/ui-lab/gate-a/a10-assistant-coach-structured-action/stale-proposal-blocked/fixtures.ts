import type { FixtureIdentity } from "../../shared/fixture-identity";
import { MATCH_W3_PENDING_STARTER_PLAYER_ID, MATCH_W3_UNFILLED_SLOT, MATCH_W3_LINEUP_REVISION, MATCH_W3_LINEUP_REVISION_CONCURRENT, MATCH_W3_NOW_PLANNING_OPEN } from "../../shared/match-w3-fixture";
import type { LineupProposalCandidate, ProposalBlockedReason } from "../shared/lineup-proposal-editor";

/**
 * A10 "stale proposal" — register row 37's second named case. The proposal was generated against
 * `MATCH_W3_LINEUP_REVISION_CONCURRENT` (standing in for a plan another coach already changed —
 * same concurrent-revision fixture W3's A07-server-conflict reuses), but the current authoritative
 * plan is `MATCH_W3_LINEUP_REVISION`. Apply is blocked BEFORE any submit — this is a structural
 * "reject before render" case (`12_ACTION_OWNERSHIP_AND_GUARDRAILS.md`), not a server CONFLICT
 * discovered after confirming.
 */
export const identity: FixtureIdentity = {
  scenarioId: "A10-stale-proposal-blocked",
  fixtureId: "gate-a-w4-a10-stale-proposal-blocked",
  fixtureVersion: 1,
  fixtureSha256: "0e898725c62f9d8fe0d8fdf0cdecf6c19d112783a487dafb254ef5dddff05a55",
  sourceClass: "SYNTHETIC_LABELED",
  fixedDateTimeUtc: MATCH_W3_NOW_PLANNING_OPEN.toISOString(),
  viewerTimeZone: "Europe/Oslo",
  locale: "en-GB",
};

export const slotLabel = MATCH_W3_UNFILLED_SLOT;
export const currentPlanRevision = MATCH_W3_LINEUP_REVISION;
export const proposalExpectedRevision = MATCH_W3_LINEUP_REVISION_CONCURRENT;

export const proposal: LineupProposalCandidate = {
  proposalId: "prop-w4-a10-02",
  playerId: MATCH_W3_PENDING_STARTER_PLAYER_ID,
  displayName: "Tobias",
  shirtNumber: 12,
  evidenceRefs: ["src-fact-slot-rcm-empty", "src-fact-player-declared-cm"],
  rationale: "A declared central-midfield position makes this a possible candidate for review. Actual playing minutes at this position are not recorded.",
  limitations: ["No completed-match minutes recorded for this tactical position."],
  expectedConsequences: ["The draft would place the selected player in the currently empty RCM slot."],
};

export const blockedReason: ProposalBlockedReason = {
  kind: "STALE",
  message: `The match plan changed after this proposal was generated (expected revision ${proposalExpectedRevision}, current revision ${currentPlanRevision}). Ask Assistant Coach to review again before applying.`,
};

export const rawRecordsForHash = { slotLabel, proposal, proposalExpectedRevision, currentPlanRevision, blockedReason };
