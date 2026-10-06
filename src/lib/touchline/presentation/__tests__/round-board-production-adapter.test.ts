import { describe, it, expect } from "vitest";
import { sortAttentionForSelection, buildRoundBoardDevelopmentContext } from "../round-board-production-adapter";
import type { RoundBoardAttentionItem } from "../round-board-view-model";

function item(overrides: Partial<RoundBoardAttentionItem> & Pick<RoundBoardAttentionItem, "id" | "severity">): RoundBoardAttentionItem {
  return { playerId: null, matchId: null, summary: "", detail: "", ...overrides };
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
