import { describe, it, expect } from "vitest";
import { validateLineupProposal, resolveProposalEvidence, type LineupSlotAssignmentProposal } from "../lineup-proposal-contract";
import { a10ValidationContext, A10_MATCH_ID, A10_GROUP_ID, A10_TARGET_SLOT_ID, A10_CURRENT_REVISION, A10_EVIDENCE_CATALOG, A10_SLOT_OCCUPANTS } from "../lineup-proposal-fixture";
import { MATCH_W3_PENDING_STARTER_PLAYER_ID } from "../../../shared/match-w3-fixture";

const tobias = MATCH_W3_PENDING_STARTER_PLAYER_ID;
const oskarGk = "player-w3-oskar";
const sindreLcm = "player-w3-sindre";

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
    playerId: tobias,
    before: { playerId: null },
    after: { playerId: tobias },
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

describe("validateLineupProposal — N1: exact-target-slot occupancy (not a single hardcoded slot)", () => {
  it("A10_SLOT_OCCUPANTS reflects the real authoritative starting lineup, not a re-authored copy", () => {
    expect(A10_SLOT_OCCUPANTS.get("slot-GK")).toBe(oskarGk);
    expect(A10_SLOT_OCCUPANTS.get("slot-LCM")).toBe(sindreLcm);
    expect(A10_SLOT_OCCUPANTS.get("slot-RCM")).toBeNull();
  });

  it("accepts a correctly-described assignment into the genuinely empty RCM slot", () => {
    const result = validateLineupProposal(validProposal(), a10ValidationContext());
    expect(result).toMatchObject({ valid: true, applicability: "APPLICABLE" });
  });

  it("rejects a proposal claiming GK is empty (before: null) when Oskar actually occupies it — the exact regression this finding reported", () => {
    const result = validateLineupProposal(
      validProposal({ slotId: "slot-GK", before: { playerId: null }, after: { playerId: tobias } }),
      a10ValidationContext(),
    );
    expect(result).toMatchObject({ valid: false, code: "BEFORE_STATE_MISMATCH" });
  });

  it("accepts a correctly-described replacement at an OCCUPIED slot (GK: Oskar -> Tobias) — proves the resolver reads the real occupant, not just 'empty'", () => {
    const result = validateLineupProposal(
      validProposal({ slotId: "slot-GK", before: { playerId: oskarGk }, after: { playerId: tobias } }),
      a10ValidationContext(),
    );
    expect(result).toMatchObject({ valid: true, applicability: "APPLICABLE" });
  });

  it("requires the correct target-slot occupant even when the WRONG occupant is a real player elsewhere in the fixture", () => {
    // Claims GK's occupant is Sindre (actually at LCM) — still wrong, still rejected.
    const result = validateLineupProposal(
      validProposal({ slotId: "slot-GK", before: { playerId: sindreLcm }, after: { playerId: tobias } }),
      a10ValidationContext(),
    );
    expect(result).toMatchObject({ valid: false, code: "BEFORE_STATE_MISMATCH" });
  });
});

describe("validateLineupProposal — duplicate on-pitch assignment prevention", () => {
  it("rejects assigning a player who already occupies a different slot", () => {
    // Sindre already occupies LCM; proposing him for the empty RCM slot too must be rejected —
    // this candidate only models a plain assignment into an empty slot, never a silent
    // two-slot duplication.
    const result = validateLineupProposal(validProposal({ playerId: sindreLcm, after: { playerId: sindreLcm } }), a10ValidationContext());
    expect(result).toMatchObject({ valid: false, code: "DUPLICATE_ASSIGNMENT" });
  });

  it("does not reject a player who occupies the SAME target slot being described as the before-state", () => {
    // Replacing Oskar at GK with Tobias — Oskar's own occupancy of slot-GK is the `before`, not a
    // duplicate-assignment violation.
    const result = validateLineupProposal(
      validProposal({ slotId: "slot-GK", before: { playerId: oskarGk }, after: { playerId: tobias } }),
      a10ValidationContext(),
    );
    expect(result).toMatchObject({ valid: true, applicability: "APPLICABLE" });
  });
});

describe("validateLineupProposal — invalid proposals never enter an actionable state", () => {
  it("rejects a missing proposal identity as MALFORMED_PAYLOAD", () => {
    const result = validateLineupProposal(validProposal({ proposalId: "" }), a10ValidationContext());
    expect(result).toMatchObject({ valid: false, code: "MALFORMED_PAYLOAD" });
  });

  it("rejects an unsupported action kind", () => {
    const result = validateLineupProposal(
      { ...validProposal(), proposalKind: "UPDATE_PLAYER_RATING" },
      a10ValidationContext(),
    );
    expect(result).toMatchObject({ valid: false, code: "UNSUPPORTED_ACTION_KIND" });
  });

  it("rejects an unsupported producer", () => {
    const result = validateLineupProposal({ ...validProposal(), proposedBy: "HUMAN" }, a10ValidationContext());
    expect(result).toMatchObject({ valid: false, code: "UNSUPPORTED_PRODUCER" });
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

  it("rejects a diff where after.playerId does not match the proposed player", () => {
    const result = validateLineupProposal(validProposal({ after: { playerId: sindreLcm } }), a10ValidationContext());
    expect(result).toMatchObject({ valid: false, code: "BAD_DIFF" });
  });

  it("rejects a no-op diff (before === after), distinct from a before-state mismatch", () => {
    const result = validateLineupProposal(
      validProposal({ slotId: "slot-GK", playerId: oskarGk, before: { playerId: oskarGk }, after: { playerId: oskarGk } }),
      a10ValidationContext(),
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

  it("rejects a proposal citing player-specific evidence about an unrelated player", () => {
    const result = validateLineupProposal(validProposal({ evidenceRefs: ["src-fact-other-player-evidence"] }), a10ValidationContext());
    expect(result).toMatchObject({ valid: false, code: "EVIDENCE_SUBJECT_MISMATCH" });
  });

  it("accepts match-level evidence (playerId: null) alongside player-specific evidence", () => {
    // src-fact-slot-rcm-empty has playerId: null (match-level) — must not be rejected as a subject
    // mismatch merely because the proposal itself concerns a specific player.
    const result = validateLineupProposal(validProposal({ evidenceRefs: ["src-fact-slot-rcm-empty"] }), a10ValidationContext());
    expect(result).toMatchObject({ valid: true, applicability: "APPLICABLE" });
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

/**
 * N4: the validator must accept `unknown` and never throw — every malformed input below is a
 * genuinely untyped runtime value (not a TypeScript cast of an invalid value into the declared
 * type), reflecting what a real provider-shaped payload could actually contain.
 */
describe("validateLineupProposal — N4: non-throwing runtime shape validation", () => {
  const ctx = a10ValidationContext();

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "not a proposal"],
    ["a number", 42],
    ["an array", [1, 2, 3]],
    ["an empty object", {}],
  ])("does not throw and returns MALFORMED_PAYLOAD for %s", (_label, raw) => {
    expect(() => validateLineupProposal(raw, ctx)).not.toThrow();
    const result = validateLineupProposal(raw, ctx);
    expect(result).toMatchObject({ valid: false, code: "MALFORMED_PAYLOAD" });
  });

  it("rejects a payload with before missing entirely, without throwing", () => {
    const { before: _before, ...rest } = validProposal();
    expect(() => validateLineupProposal(rest, ctx)).not.toThrow();
    expect(validateLineupProposal(rest, ctx)).toMatchObject({ valid: false, code: "MALFORMED_PAYLOAD" });
  });

  it("rejects a payload with after missing entirely, without throwing", () => {
    const { after: _after, ...rest } = validProposal();
    expect(() => validateLineupProposal(rest, ctx)).not.toThrow();
    expect(validateLineupProposal(rest, ctx)).toMatchObject({ valid: false, code: "MALFORMED_PAYLOAD" });
  });

  it("rejects before: null (the object itself, not its playerId field)", () => {
    const malformed = { ...validProposal(), before: null };
    expect(() => validateLineupProposal(malformed, ctx)).not.toThrow();
    expect(validateLineupProposal(malformed, ctx)).toMatchObject({ valid: false, code: "MALFORMED_PAYLOAD" });
  });

  it("rejects after: null (the object itself)", () => {
    const malformed = { ...validProposal(), after: null };
    expect(() => validateLineupProposal(malformed, ctx)).not.toThrow();
    expect(validateLineupProposal(malformed, ctx)).toMatchObject({ valid: false, code: "MALFORMED_PAYLOAD" });
  });

  it("rejects a numeric playerId (wrong field type)", () => {
    const malformed = { ...validProposal(), playerId: 12345 };
    expect(validateLineupProposal(malformed, ctx)).toMatchObject({ valid: false, code: "MALFORMED_PAYLOAD" });
  });

  it("rejects an empty insightId", () => {
    const result = validateLineupProposal(validProposal({ insightId: "" }), ctx);
    expect(result).toMatchObject({ valid: false, code: "MALFORMED_PAYLOAD" });
  });

  it("rejects an empty expectedRevision", () => {
    const result = validateLineupProposal(validProposal({ expectedRevision: "" }), ctx);
    expect(result).toMatchObject({ valid: false, code: "MALFORMED_PAYLOAD" });
  });

  it("rejects an evidenceRefs array containing a non-string element", () => {
    const malformed = { ...validProposal(), evidenceRefs: ["src-fact-slot-rcm-empty", 7] };
    expect(() => validateLineupProposal(malformed, ctx)).not.toThrow();
    expect(validateLineupProposal(malformed, ctx)).toMatchObject({ valid: false, code: "MALFORMED_PAYLOAD" });
  });

  it("rejects evidenceRefs that is not an array at all", () => {
    const malformed = { ...validProposal(), evidenceRefs: "src-fact-slot-rcm-empty" };
    expect(() => validateLineupProposal(malformed, ctx)).not.toThrow();
    expect(validateLineupProposal(malformed, ctx)).toMatchObject({ valid: false, code: "MALFORMED_PAYLOAD" });
  });

  it("rejects a missing or empty rationale", () => {
    const malformed = { ...validProposal(), rationale: "" };
    expect(validateLineupProposal(malformed, ctx)).toMatchObject({ valid: false, code: "MALFORMED_PAYLOAD" });
  });

  it("rejects an expectedConsequences array containing a non-string element", () => {
    const malformed = { ...validProposal(), expectedConsequences: [42] };
    expect(() => validateLineupProposal(malformed, ctx)).not.toThrow();
    expect(validateLineupProposal(malformed, ctx)).toMatchObject({ valid: false, code: "MALFORMED_PAYLOAD" });
  });

  it("rejects a payload with an unexpected extra field (strict shape)", () => {
    const malformed = { ...validProposal(), unexpectedField: "should not be here" };
    expect(validateLineupProposal(malformed, ctx)).toMatchObject({ valid: false, code: "MALFORMED_PAYLOAD" });
  });

  it("never throws across the entire malformed-input sweep, win or lose", () => {
    const malformedInputs: unknown[] = [null, undefined, "x", [], {}, { ...validProposal(), before: undefined }, { ...validProposal(), playerId: null }];
    for (const input of malformedInputs) {
      expect(() => validateLineupProposal(input, ctx)).not.toThrow();
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
