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
describe("round-board-production-adapter — buildRoundBoardViewModel attention resolvability (Gate C W2 / P1-01)", () => {
  it("player-specific item: resolvable when an open destination other than their current match exists", () => {
    const vm = buildRoundBoardViewModel({
      roundLabel: "R", dateRangeLabel: "",
      matches: [
        match({ matchId: "closed", isFinalized: true, players: [{ playerId: "p1", displayName: "A", shirtNumber: null, kitColor: null, position: null, role: "CORE", attention: false }] }),
        match({ matchId: "open", isFinalized: false }),
      ],
      attentionSignals: [{ id: "s1", summary: "A", detail: "", severity: "DECISION_REQUIRED", playerId: "p1" }],
      eligibleCoverage: { eligiblePlayerCount: 1, assignedEligiblePlayerCount: 1 },
    });
    expect(vm.attention[0]!.resolvable).toBe(true);
  });

  it("player-specific item: not resolvable when every other match is closed", () => {
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
