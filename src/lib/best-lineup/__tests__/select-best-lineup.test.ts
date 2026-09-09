import { describe, expect, it } from "vitest";
import {
  selectBestLineupAssignments,
  type BestLineupCandidate,
  type BestLineupSlotInput,
} from "../select-best-lineup";
import type { FormationSlotRoleType } from "@/lib/formations/types";

function slot(slotId: string, roleType: FormationSlotRoleType, gridX: number): BestLineupSlotInput {
  return { slotId, roleType, gridX };
}
function cand(
  id: string,
  primary: string,
  opts: { secondary?: string; tertiary?: string; rating?: number; bestSide?: BestLineupCandidate["bestSide"] } = {},
): BestLineupCandidate {
  return {
    id,
    primaryPosition: primary,
    secondaryPosition: opts.secondary ?? null,
    tertiaryPosition: opts.tertiary ?? null,
    bestSide: opts.bestSide ?? "CENTER",
    rating: opts.rating ?? 5,
  };
}
const NO_LOCKS = new Map<string, string>();

describe("selectBestLineupAssignments", () => {
  it("prefers a higher fit tier over a higher rating (tier is not a rating tiebreak)", () => {
    const result = selectBestLineupAssignments(
      [slot("lm", "MIDFIELDER", 0)],
      [cand("naturalLowRated", "LM", { rating: 1 }), cand("plausibleTopRated", "CM", { rating: 10 })],
      NO_LOCKS,
      "seed",
    );
    expect(result.get("lm")).toBe("naturalLowRated");
  });

  it("uses rating to break a tie within the same tier", () => {
    const result = selectBestLineupAssignments(
      [slot("cb", "DEFENDER", 2)],
      [cand("lowRated", "CB", { rating: 3 }), cand("highRated", "CB", { rating: 9 })],
      NO_LOCKS,
      "seed",
    );
    expect(result.get("cb")).toBe("highRated");
  });

  it("never assigns an UNSUPPORTED player — the slot is simply left empty", () => {
    const result = selectBestLineupAssignments(
      [slot("lw", "FORWARD", 0)],
      [cand("centreBack", "CB", { rating: 10 })],
      NO_LOCKS,
      "seed",
    );
    expect(result.has("lw")).toBe(false);
  });

  it("fills the goalkeeper slot from a declared goalkeeper only, best rating first", () => {
    const result = selectBestLineupAssignments(
      [slot("gk", "GOALKEEPER", 2), slot("cb", "DEFENDER", 2)],
      [cand("gkA", "GK", { rating: 4 }), cand("gkB", "GK", { rating: 8 }), cand("def", "CB", { rating: 9 })],
      NO_LOCKS,
      "seed",
    );
    expect(result.get("gk")).toBe("gkB");
    expect(result.get("cb")).toBe("def");
  });

  it("leaves the goalkeeper slot empty rather than filling it with an outfield player", () => {
    const result = selectBestLineupAssignments(
      [slot("gk", "GOALKEEPER", 2)],
      [cand("def", "CB", { rating: 10 }), cand("st", "ST", { rating: 10 })],
      NO_LOCKS,
      "seed",
    );
    expect(result.has("gk")).toBe(false);
  });

  it("honours a locked assignment even when the player is outside automatic fit", () => {
    const locks = new Map([["lw", "centreBack"]]);
    const result = selectBestLineupAssignments(
      [slot("lw", "FORWARD", 0)],
      [cand("centreBack", "CB", { rating: 6 })],
      locks,
      "seed",
    );
    expect(result.get("lw")).toBe("centreBack");
  });

  it("matches a scarce wide role rather than duplicating one player", () => {
    const result = selectBestLineupAssignments(
      [slot("lw", "FORWARD", 0), slot("rw", "FORWARD", 4)],
      [cand("wide", "W"), cand("leftOnly", "LW")],
      NO_LOCKS,
      "seed",
    );
    expect(new Set([result.get("lw"), result.get("rw")])).toEqual(new Set(["wide", "leftOnly"]));
  });

  it("never auto-fills a FREE slot", () => {
    const result = selectBestLineupAssignments(
      [slot("free", "FREE", 2)],
      [cand("any", "CM", { rating: 10 })],
      NO_LOCKS,
      "seed",
    );
    expect(result.has("free")).toBe(false);
  });

  it("is deterministic for identical input", () => {
    const slots = [slot("lb", "DEFENDER", 0), slot("cb", "DEFENDER", 2), slot("rb", "DEFENDER", 4)];
    const candidates = [cand("a", "CB"), cand("b", "LB"), cand("c", "RB"), cand("d", "CB")];
    const r1 = selectBestLineupAssignments(slots, candidates, NO_LOCKS, "seed");
    const r2 = selectBestLineupAssignments(slots, candidates, NO_LOCKS, "seed");
    expect([...r1.entries()].sort()).toEqual([...r2.entries()].sort());
  });
});
