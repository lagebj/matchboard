import { describe, it, expect } from "vitest";
import { sortAttentionForSelection, buildRoundBoardDevelopmentContext, buildRoundBoardViewModel } from "../round-board-production-adapter";
import type { RoundBoardAttentionItem } from "../round-board-view-model";

describe("round-board-production-adapter — buildRoundBoardViewModel eligibleCoverage (Gate C W2 / C04)", () => {
  it("passes the given eligibleCoverage through unchanged, never re-deriving it", () => {
    const vm = buildRoundBoardViewModel({
      roundLabel: "Round 1",
      dateRangeLabel: "",
      matches: [],
      attentionSignals: [],
      eligibleCoverage: { eligiblePlayerCount: 9, assignedEligiblePlayerCount: 4 },
    });
    expect(vm.summary.eligibleCoverage).toEqual({ eligiblePlayerCount: 9, assignedEligiblePlayerCount: 4 });
  });

  it("keeps eligibleCoverage distinct from plannedOpportunities/targetOpportunities (squad placements, not distinct players)", () => {
    const vm = buildRoundBoardViewModel({
      roundLabel: "Round 1",
      dateRangeLabel: "",
      matches: [
        {
          matchId: "m1",
          teamName: "Blue",
          teamKitColor: null,
          opponent: "Rivals",
          matchDate: new Date("2026-01-01"),
          targetSquadSize: 11,
          minSquadSize: 7,
          isFinalized: false,
          players: [
            { playerId: "p1", displayName: "Alice", shirtNumber: null, kitColor: null, position: null, role: "CORE", attention: false },
          ],
        },
      ],
      attentionSignals: [],
      eligibleCoverage: { eligiblePlayerCount: 5, assignedEligiblePlayerCount: 1 },
    });
    expect(vm.summary.plannedOpportunities).toBe(1);
    expect(vm.summary.targetOpportunities).toBe(11);
    expect(vm.summary.eligibleCoverage).toEqual({ eligiblePlayerCount: 5, assignedEligiblePlayerCount: 1 });
  });
});

function match(overrides: Partial<Parameters<typeof buildRoundBoardViewModel>[0]["matches"][number]> & { matchId: string }) {
  return {
    teamName: "", teamKitColor: null, opponent: "", matchDate: new Date("2026-01-01"),
    targetSquadSize: 11, minSquadSize: 7, isFinalized: false, players: [],
    ...overrides,
  };
}

// Gate C W2 remediation (P1-01): `resolvable` must come from the canonical per-match boundary
// (never the round-level boundary alone — a mixed round has both open and closed matches).
// Re-opened in a second remediation pass: the first fix checked only the DESTINATION side —
// a player assigned to a CLOSED match was still marked resolvable whenever any OTHER match
// happened to be open, even though the central movePlayerToMatch command rejects moving them
// out of that closed match regardless. The decision matrix below is the review's own required
// table (player state x warning-owner match x other-match state -> resolvable).
describe("round-board-production-adapter — buildRoundBoardViewModel attention resolvability (Gate C W2 / P1-01)", () => {
  it("unassigned player, open or unspecified warning owner, an open match exists: resolvable", () => {
    const vm = buildRoundBoardViewModel({
      roundLabel: "R", dateRangeLabel: "",
      matches: [match({ matchId: "open", isFinalized: false })],
      attentionSignals: [{ id: "s1", summary: "A", detail: "", severity: "DECISION_REQUIRED", playerId: "p-unassigned" }],
      eligibleCoverage: { eligiblePlayerCount: 1, assignedEligiblePlayerCount: 0 },
    });
    expect(vm.attention[0]!.resolvable).toBe(true);
  });

  it("player assigned to an OPEN match, another open match exists: resolvable", () => {
    const vm = buildRoundBoardViewModel({
      roundLabel: "R", dateRangeLabel: "",
      matches: [
        match({ matchId: "open1", isFinalized: false, players: [{ playerId: "p1", displayName: "A", shirtNumber: null, kitColor: null, position: null, role: "CORE", attention: false }] }),
        match({ matchId: "open2", isFinalized: false }),
      ],
      attentionSignals: [{ id: "s1", summary: "A", detail: "", severity: "DECISION_REQUIRED", playerId: "p1" }],
      eligibleCoverage: { eligiblePlayerCount: 1, assignedEligiblePlayerCount: 1 },
    });
    expect(vm.attention[0]!.resolvable).toBe(true);
  });

  it("player assigned to a CLOSED match, another match is open: NOT resolvable (the source itself is closed)", () => {
    const vm = buildRoundBoardViewModel({
      roundLabel: "R", dateRangeLabel: "",
      matches: [
        match({ matchId: "closed", isFinalized: true, players: [{ playerId: "p1", displayName: "A", shirtNumber: null, kitColor: null, position: null, role: "CORE", attention: false }] }),
        match({ matchId: "open", isFinalized: false }),
      ],
      attentionSignals: [{ id: "s1", summary: "A", detail: "", severity: "DECISION_REQUIRED", playerId: "p1" }],
      eligibleCoverage: { eligiblePlayerCount: 1, assignedEligiblePlayerCount: 1 },
    });
    expect(vm.attention[0]!.resolvable).toBe(false);
  });

  it("player assigned to a CLOSED match, every other match is also closed: not resolvable", () => {
    const vm = buildRoundBoardViewModel({
      roundLabel: "R", dateRangeLabel: "",
      matches: [
        match({ matchId: "closed1", isFinalized: true, players: [{ playerId: "p1", displayName: "A", shirtNumber: null, kitColor: null, position: null, role: "CORE", attention: false }] }),
        match({ matchId: "closed2", isFinalized: true }),
      ],
      attentionSignals: [{ id: "s1", summary: "A", detail: "", severity: "DECISION_REQUIRED", playerId: "p1" }],
      eligibleCoverage: { eligiblePlayerCount: 1, assignedEligiblePlayerCount: 1 },
    });
    expect(vm.attention[0]!.resolvable).toBe(false);
  });

  it("unassigned player, every match is closed: not resolvable", () => {
    const vm = buildRoundBoardViewModel({
      roundLabel: "R", dateRangeLabel: "",
      matches: [match({ matchId: "closed", isFinalized: true })],
      attentionSignals: [{ id: "s1", summary: "A", detail: "", severity: "DECISION_REQUIRED", playerId: "p-unassigned" }],
      eligibleCoverage: { eligiblePlayerCount: 1, assignedEligiblePlayerCount: 0 },
    });
    expect(vm.attention[0]!.resolvable).toBe(false);
  });

  it("match-specific item (no player): resolvable only when that exact match is open", () => {
    const vm = buildRoundBoardViewModel({
      roundLabel: "R", dateRangeLabel: "",
      matches: [match({ matchId: "m-open", isFinalized: false }), match({ matchId: "m-closed", isFinalized: true })],
      attentionSignals: [
        { id: "s1", summary: "", detail: "", severity: "BLOCKED", matchId: "m-open" },
        { id: "s2", summary: "", detail: "", severity: "BLOCKED", matchId: "m-closed" },
      ],
      eligibleCoverage: { eligiblePlayerCount: 0, assignedEligiblePlayerCount: 0 },
    });
    expect(vm.attention.find((a) => a.id === "s1")!.resolvable).toBe(true);
    expect(vm.attention.find((a) => a.id === "s2")!.resolvable).toBe(false);
  });

  it("fail-safe: an item with neither playerId nor matchId is never resolvable", () => {
    const vm = buildRoundBoardViewModel({
      roundLabel: "R", dateRangeLabel: "",
      matches: [match({ matchId: "m1", isFinalized: false })],
      attentionSignals: [{ id: "s1", summary: "", detail: "", severity: "BLOCKED" }],
      eligibleCoverage: { eligiblePlayerCount: 0, assignedEligiblePlayerCount: 0 },
    });
    expect(vm.attention[0]!.resolvable).toBe(false);
  });
});

describe("round-board-production-adapter — resolvability respects the warning's OWNING match, independently of the player's current match (third remediation pass)", () => {
  it("unassigned player, warning owned by a CLOSED match, another match is open: NOT resolvable", () => {
    const vm = buildRoundBoardViewModel({
      roundLabel: "R", dateRangeLabel: "",
      matches: [match({ matchId: "closed", isFinalized: true }), match({ matchId: "open", isFinalized: false })],
      attentionSignals: [{ id: "s1", summary: "A", detail: "", severity: "DECISION_REQUIRED", playerId: "p-unassigned", matchId: "closed" }],
      eligibleCoverage: { eligiblePlayerCount: 1, assignedEligiblePlayerCount: 0 },
    });
    expect(vm.attention[0]!.resolvable).toBe(false);
  });

  it("player assigned elsewhere (open), warning owned by a CLOSED match: NOT resolvable — ownership alone is decisive", () => {
    const vm = buildRoundBoardViewModel({
      roundLabel: "R", dateRangeLabel: "",
      matches: [
        match({ matchId: "closed", isFinalized: true }),
        match({ matchId: "open-source", isFinalized: false, players: [{ playerId: "p1", displayName: "A", shirtNumber: null, kitColor: null, position: null, role: "CORE", attention: false }] }),
      ],
      attentionSignals: [{ id: "s1", summary: "A", detail: "", severity: "DECISION_REQUIRED", playerId: "p1", matchId: "closed" }],
      eligibleCoverage: { eligiblePlayerCount: 1, assignedEligiblePlayerCount: 1 },
    });
    expect(vm.attention[0]!.resolvable).toBe(false);
  });

  it("player assigned to a CLOSED source match, warning owned by an OPEN match: NOT resolvable — the player's own source boundary is still decisive", () => {
    const vm = buildRoundBoardViewModel({
      roundLabel: "R", dateRangeLabel: "",
      matches: [
        match({ matchId: "closed-source", isFinalized: true, players: [{ playerId: "p1", displayName: "A", shirtNumber: null, kitColor: null, position: null, role: "CORE", attention: false }] }),
        match({ matchId: "open-owner", isFinalized: false }),
      ],
      attentionSignals: [{ id: "s1", summary: "A", detail: "", severity: "DECISION_REQUIRED", playerId: "p1", matchId: "open-owner" }],
      eligibleCoverage: { eligiblePlayerCount: 1, assignedEligiblePlayerCount: 1 },
    });
    expect(vm.attention[0]!.resolvable).toBe(false);
  });

  it("unassigned player, warning owned by an OPEN match, a valid destination exists: resolvable", () => {
    const vm = buildRoundBoardViewModel({
      roundLabel: "R", dateRangeLabel: "",
      matches: [match({ matchId: "open-owner", isFinalized: false })],
      attentionSignals: [{ id: "s1", summary: "A", detail: "", severity: "DECISION_REQUIRED", playerId: "p-unassigned", matchId: "open-owner" }],
      eligibleCoverage: { eligiblePlayerCount: 1, assignedEligiblePlayerCount: 0 },
    });
    expect(vm.attention[0]!.resolvable).toBe(true);
  });

  it("missing warning ownership (no matchId), unassigned player, a valid destination exists: still resolvable", () => {
    const vm = buildRoundBoardViewModel({
      roundLabel: "R", dateRangeLabel: "",
      matches: [match({ matchId: "open", isFinalized: false })],
      attentionSignals: [{ id: "s1", summary: "A", detail: "", severity: "DECISION_REQUIRED", playerId: "p-unassigned" }],
      eligibleCoverage: { eligiblePlayerCount: 1, assignedEligiblePlayerCount: 0 },
    });
    expect(vm.attention[0]!.resolvable).toBe(true);
  });

  it("match-only warning (no playerId) on a CLOSED owning match: not resolvable — unchanged by this pass", () => {
    const vm = buildRoundBoardViewModel({
      roundLabel: "R", dateRangeLabel: "",
      matches: [match({ matchId: "closed", isFinalized: true })],
      attentionSignals: [{ id: "s1", summary: "", detail: "", severity: "BLOCKED", matchId: "closed" }],
      eligibleCoverage: { eligiblePlayerCount: 0, assignedEligiblePlayerCount: 0 },
    });
    expect(vm.attention[0]!.resolvable).toBe(false);
  });

  it("match-only warning (no playerId) on an OPEN owning match: resolvable — unchanged by this pass", () => {
    const vm = buildRoundBoardViewModel({
      roundLabel: "R", dateRangeLabel: "",
      matches: [match({ matchId: "open", isFinalized: false })],
      attentionSignals: [{ id: "s1", summary: "", detail: "", severity: "BLOCKED", matchId: "open" }],
      eligibleCoverage: { eligiblePlayerCount: 0, assignedEligiblePlayerCount: 0 },
    });
    expect(vm.attention[0]!.resolvable).toBe(true);
  });
});

function item(overrides: Partial<RoundBoardAttentionItem> & Pick<RoundBoardAttentionItem, "id" | "severity">): RoundBoardAttentionItem {
  return { playerId: null, matchId: null, summary: "", detail: "", resolvable: false, ...overrides };
}

describe("round-board-production-adapter — sortAttentionForSelection", () => {
  it("puts BLOCKED items before DECISION_REQUIRED items", () => {
    const result = sortAttentionForSelection(
      [item({ id: "d1", severity: "DECISION_REQUIRED" }), item({ id: "b1", severity: "BLOCKED" })],
      null,
    );
    expect(result.map((i) => i.id)).toEqual(["b1", "d1"]);
  });

  it("preserves original order within the same severity when no player is selected", () => {
    const result = sortAttentionForSelection(
      [item({ id: "b1", severity: "BLOCKED" }), item({ id: "b2", severity: "BLOCKED" })],
      null,
    );
    expect(result.map((i) => i.id)).toEqual(["b1", "b2"]);
  });

  it("floats the selected player's rows to the top within their severity group", () => {
    const result = sortAttentionForSelection(
      [
        item({ id: "b1", severity: "BLOCKED", playerId: "other" }),
        item({ id: "b2", severity: "BLOCKED", playerId: "selected" }),
      ],
      "selected",
    );
    expect(result.map((i) => i.id)).toEqual(["b2", "b1"]);
  });

  it("never lets a selected player's DECISION_REQUIRED row outrank an unrelated BLOCKED row", () => {
    const result = sortAttentionForSelection(
      [
        item({ id: "d1", severity: "DECISION_REQUIRED", playerId: "selected" }),
        item({ id: "b1", severity: "BLOCKED", playerId: "other" }),
      ],
      "selected",
    );
    expect(result.map((i) => i.id)).toEqual(["b1", "d1"]);
  });
});

describe("round-board-production-adapter — buildRoundBoardDevelopmentContext", () => {
  it("passes through the given facts without inventing a recommendation", () => {
    const result = buildRoundBoardDevelopmentContext({
      playerId: "p1",
      displayName: "Noah",
      activeFocusCategories: ["FIRST_TOUCH"],
      effectivePositions: [{ positionId: "CM", supportBand: "STRONG", confidence: "MEDIUM", appearances: 3, minutes: 180 }],
    });
    expect(result).toEqual({
      playerId: "p1",
      displayName: "Noah",
      activeFocusCategories: ["FIRST_TOUCH"],
      effectivePositions: [{ positionId: "CM", supportBand: "STRONG", confidence: "MEDIUM", appearances: 3, minutes: 180 }],
    });
  });
});
