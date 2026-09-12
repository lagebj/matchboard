import { describe, it, expect } from "vitest";
import { computeMatchSquadBalance } from "../get-match-squad-balance";

describe("computeMatchSquadBalance", () => {
  it("buckets CORE, SUPPORT, DEVELOPMENT, and HELPER independently", () => {
    const result = computeMatchSquadBalance([
      { role: "CORE" }, { role: "CORE" }, { role: "CORE" },
      { role: "SUPPORT" },
      { role: "DEVELOPMENT" }, { role: "DEVELOPMENT" },
      { role: "HELPER" },
    ]);
    expect(result).toEqual({ core: 3, support: 1, development: 2, matchday: 1 });
  });

  it("buckets legacy BACKFILL together with SUPPORT", () => {
    const result = computeMatchSquadBalance([{ role: "SUPPORT" }, { role: "BACKFILL" }]);
    expect(result.support).toBe(2);
  });

  it("does not attribute an unknown role to any bucket", () => {
    const result = computeMatchSquadBalance([{ role: "SOMETHING_ELSE" }]);
    expect(result).toEqual({ core: 0, support: 0, development: 0, matchday: 0 });
  });

  it("returns all zeros for an empty selection list", () => {
    expect(computeMatchSquadBalance([])).toEqual({ core: 0, support: 0, development: 0, matchday: 0 });
  });
});
