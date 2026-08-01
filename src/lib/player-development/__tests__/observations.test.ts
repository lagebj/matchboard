import { describe, it, expect } from "vitest";

const RATING_ATTRIBUTE_KEYS = [
  "ballControl", "passing", "firstTouch", "oneVOneAttacking", "positioning",
  "oneVOneDefending", "decisionMaking", "effort", "teamplay", "concentration",
  "speed", "strength",
] as const;

describe("Development observations constants", () => {
  it("has exactly 12 rating attribute keys", () => {
    expect(RATING_ATTRIBUTE_KEYS).toHaveLength(12);
  });

  it("includes all expected attributes", () => {
    const expected = [
      "ballControl", "passing", "firstTouch", "oneVOneAttacking", "positioning",
      "oneVOneDefending", "decisionMaking", "effort", "teamplay", "concentration",
      "speed", "strength",
    ];
    expect(RATING_ATTRIBUTE_KEYS).toEqual(expected);
  });
});