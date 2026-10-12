import { describe, it, expect } from "vitest";
import { validateLineupProposal, resolveProposalEvidence, type LineupSlotAssignmentProposal } from "../lineup-proposal-contract";
import { a10ValidationContext, A10_MATCH_ID, A10_GROUP_ID, A10_TARGET_SLOT_ID, A10_CURRENT_REVISION, A10_EVIDENCE_CATALOG } from "../lineup-proposal-fixture";
import { MATCH_W3_PENDING_STARTER_PLAYER_ID } from "../../../shared/match-w3-fixture";

const basePlayerId = MATCH_W3_PENDING_STARTER_PLAYER_ID;

function validProposal(overrides: Partial<LineupSlotAssignmentProposal> = {}): LineupSlotAssignmentProposal {
  return {
    proposalId: "prop-w4-a10-test",
    insightId: "ai:lineup-option-rcm",
    proposalKind: "ASSIGN_PLAYER_TO_LINEUP_SLOT",
    proposedBy: "AI",
    matchId: A10_MATCH_ID,
    groupId: A10_GROUP_ID,
    expectedRevision: A10_CURRENT_REVISION,
    slotId: A10_TARGET_SLOT_ID,
    playerId: basePlayerId,
    before: { playerId: null },
    after: { playerId: basePlayerId },
    evidenceRefs: ["src-fact-slot-rcm-empty", "src-fact-player-declared-cm"],
    rationale: "A declared central-midfield position makes this a possible candidate for review.",
    limitations: ["No completed-match minutes recorded for this tactical position."],
    expectedConsequences: ["The draft would place the selected player in the currently empty RCM slot."],
    ...overrides,
  };
}

describe("validateLineupProposal — the valid case", () => {
  it("accepts a well-formed, in-scope, fresh-revision proposal as APPLICABLE", () => {
    const result = validateLineupProposal(validProposal(), a10ValidationContext());
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.applicability).toBe("APPLICABLE");
  });
});

describe("validateLineupProposal — invalid proposals never enter an actionable state", () => {
  it("rejects a missing proposal identity as MALFORMED_PAYLOAD", () => {
    const result = validateLineupProposal(validProposal({ proposalId: "" }), a10ValidationContext());
    expect(result).toMatchObject({ valid: false, code: "MALFORMED_PAYLOAD" });
  });

  it("rejects an unsupported action kind", () => {
    const result = validateLineupProposal(
      validProposal({ proposalKind: "UPDATE_PLAYER_RATING" as LineupSlotAssignmentProposal["proposalKind"] }),
      a10ValidationContext(),
    );
    expect(result).toMatchObject({ valid: false, code: "UNSUPPORTED_ACTION_KIND" });
  });

  it("rejects a proposal from an unknown/other match", () => {
    const result = validateLineupProposal(validProposal({ matchId: "match-w4-other-01" }), a10ValidationContext());
    expect(result).toMatchObject({ valid: false, code: "SCOPE_MISMATCH" });
  });

  it("rejects a proposal from an unknown/other group", () => {
    const result = validateLineupProposal(validProposal({ groupId: "group-w4-other-01" }), a10ValidationContext());
    expect(result).toMatchObject({ valid: false, code: "SCOPE_MISMATCH" });
  });

  it("rejects a player who does not exist in this fixture universe at all", () => {
    const result = validateLineupProposal(
      validProposal({ playerId: "player-does-not-exist", before: { playerId: null }, after: { playerId: "player-does-not-exist" } }),
      a10ValidationContext(),
    );
    expect(result).toMatchObject({ valid: false, code: "UNKNOWN_PLAYER" });
  });

  it("rejects a player who exists but is not in this match's roster", () => {
    const result = validateLineupProposal(
      validProposal({
        playerId: "player-w4-not-in-any-roster",
        before: { playerId: null },
        after: { playerId: "player-w4-not-in-any-roster" },
      }),
      a10ValidationContext(),
    );
    expect(result).toMatchObject({ valid: false, code: "PLAYER_NOT_IN_ROSTER" });
  });

  it("rejects an unknown target slot", () => {
    const result = validateLineupProposal(validProposal({ slotId: "slot-ZZZ" }), a10ValidationContext());
    expect(result).toMatchObject({ valid: false, code: "UNKNOWN_SLOT" });
  });

  it("rejects a before-state that does not match the authoritative plan", () => {
    const result = validateLineupProposal(validProposal({ before: { playerId: "player-w3-someone-else" } }), a10ValidationContext());
    expect(result).toMatchObject({ valid: false, code: "BEFORE_STATE_MISMATCH" });
  });

  it("rejects a diff where after.playerId does not match the proposed player", () => {
    const result = validateLineupProposal(validProposal({ after: { playerId: "player-w3-someone-else" } }), a10ValidationContext());
    expect(result).toMatchObject({ valid: false, code: "BAD_DIFF" });
  });

  it("rejects a no-op diff (before === after), distinct from a before-state mismatch", () => {
    // currentSlotPlayerId overridden to already equal the proposed player, so the before-state
    // check passes and the no-op-diff check is the one that actually fires.
    const result = validateLineupProposal(
      validProposal({ before: { playerId: basePlayerId }, after: { playerId: basePlayerId } }),
      a10ValidationContext({ currentSlotPlayerId: basePlayerId }),
    );
    expect(result).toMatchObject({ valid: false, code: "BAD_DIFF" });
  });

  it("rejects a proposal with no evidence at all", () => {
    const result = validateLineupProposal(validProposal({ evidenceRefs: [] }), a10ValidationContext());
    expect(result).toMatchObject({ valid: false, code: "MISSING_EVIDENCE" });
  });

  it("rejects a proposal citing an evidence ref that does not exist", () => {
    const result = validateLineupProposal(validProposal({ evidenceRefs: ["src-does-not-exist"] }), a10ValidationContext());
    expect(result).toMatchObject({ valid: false, code: "UNKNOWN_EVIDENCE_REF" });
  });

  it("rejects a proposal citing evidence that belongs to another match/group", () => {
    const result = validateLineupProposal(validProposal({ evidenceRefs: ["src-fact-other-match-evidence"] }), a10ValidationContext());
    expect(result).toMatchObject({ valid: false, code: "EVIDENCE_SCOPE_MISMATCH" });
  });
});

describe("validateLineupProposal — stale revision is blocked, not structurally rejected", () => {
  it("stays valid (inspectable) but marks applicability STALE on a revision mismatch", () => {
    const result = validateLineupProposal(validProposal({ expectedRevision: "lineup-rev-2" }), a10ValidationContext({ currentRevision: "lineup-rev-1" }));
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.applicability).toBe("STALE");
      if (result.applicability === "STALE") {
        expect(result.expectedRevision).toBe("lineup-rev-2");
        expect(result.currentRevision).toBe("lineup-rev-1");
      }
    }
  });
});

describe("resolveProposalEvidence", () => {
  it("resolves every cited ref to its full inspectable source record", () => {
    const resolved = resolveProposalEvidence(validProposal(), A10_EVIDENCE_CATALOG);
    expect(resolved).toHaveLength(2);
    expect(resolved.map((e) => e.sourceId)).toEqual(["src-fact-slot-rcm-empty", "src-fact-player-declared-cm"]);
    expect(resolved.every((e) => e.matchId === A10_MATCH_ID)).toBe(true);
  });

  it("silently drops a ref that does not resolve, rather than throwing — callers that need validity use validateLineupProposal first", () => {
    const resolved = resolveProposalEvidence(validProposal({ evidenceRefs: ["src-does-not-exist"] }), A10_EVIDENCE_CATALOG);
    expect(resolved).toHaveLength(0);
  });
});
