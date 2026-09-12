import { describe, it, expect } from "vitest";
import { countUnresolvedPlanningAttention } from "../aggregate-team-attention";

describe("countUnresolvedPlanningAttention", () => {
  it("counts signals and active focuses per team", () => {
    const counts = countUnresolvedPlanningAttention(
      ["t1", "t2"],
      [{ teamId: "t1" }, { teamId: "t1" }, { teamId: "t2" }],
      [{ teamId: "t1" }],
    );
    expect(counts.get("t1")).toBe(3);
    expect(counts.get("t2")).toBe(1);
  });

  it("returns 0 for a team with no signals or focuses", () => {
    const counts = countUnresolvedPlanningAttention(["t1"], [], []);
    expect(counts.get("t1")).toBe(0);
  });

  it("ignores a signal or focus for a team not in the requested id list", () => {
    const counts = countUnresolvedPlanningAttention(["t1"], [{ teamId: "other-team" }], [{ teamId: "other-team" }]);
    expect(counts.get("t1")).toBe(0);
    expect(counts.has("other-team")).toBe(false);
  });

  it("ignores a signal with no teamId", () => {
    const counts = countUnresolvedPlanningAttention(["t1"], [{ teamId: null }, { teamId: undefined }], []);
    expect(counts.get("t1")).toBe(0);
  });
});
