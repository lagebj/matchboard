import { describe, it, expect } from "vitest";
import { CANONICAL_TACTICAL_POSITIONS } from "@/domain/positions/roles";
import {
  PROFILE_POSITIONS,
  PROFILE_TO_TACTICAL_GROUP,
  PROFILE_FLAT_GRID,
  PROFILE_GRID_VERTICAL_MARGIN_PCT,
  collapseTacticalToProfile,
  allCanonicalTacticalPositionsCovered,
  aggregateExactAppearancesByProfile,
  profileFlatGridCellKey,
  profilePositionToFlatPoint,
  type ExactPositionAppearance,
} from "../profile-position-model";

/**
 * Gate A W1 candidate data-truth invariants for the dev-only profile vocabulary
 * (`15_PLAYER_PROFILE_VS_TACTICAL_POSITION_CONTRACT.md` / `16_POSITION_SEMANTICS_TRACEABILITY.csv`).
 */
describe("Gate A profile-position model (candidate, not production)", () => {
  it("has exactly 14 profile positions", () => {
    expect(PROFILE_POSITIONS).toHaveLength(14);
  });

  it("covers every one of the 24 canonical tactical positions exactly once, with no gaps", () => {
    expect(allCanonicalTacticalPositionsCovered()).toBe(true);
    const covered = Object.values(PROFILE_TO_TACTICAL_GROUP).flat();
    expect(covered).toHaveLength(CANONICAL_TACTICAL_POSITION_COUNT());
    expect(new Set(covered).size).toBe(covered.length); // no code appears in two groups
  });

  it("collapses centre-line sided codes to their unsided profile label", () => {
    expect(collapseTacticalToProfile("LCM")).toBe("CM");
    expect(collapseTacticalToProfile("RCM")).toBe("CM");
    expect(collapseTacticalToProfile("CM")).toBe("CM");
    expect(collapseTacticalToProfile("LDM")).toBe("DM");
    expect(collapseTacticalToProfile("CDM")).toBe("DM");
  });

  it("never collapses sided wide positions into an unsided label", () => {
    expect(collapseTacticalToProfile("LW")).toBe("LW");
    expect(collapseTacticalToProfile("RW")).toBe("RW");
    expect(collapseTacticalToProfile("LB")).toBe("LB");
    expect(collapseTacticalToProfile("RB")).toBe("RB");
  });

  it("aggregates 20min LCM + 10min RCM into 30min CM across 2 appearances, preserving both sided intervals", () => {
    const appearances: ExactPositionAppearance[] = [
      { matchId: "m-1", tacticalPosition: "LCM", minutes: 20 },
      { matchId: "m-2", tacticalPosition: "RCM", minutes: 10 },
    ];
    const [aggregate] = aggregateExactAppearancesByProfile(appearances);
    expect(aggregate.profile).toBe("CM");
    expect(aggregate.totalMinutes).toBe(30);
    expect(aggregate.appearanceCount).toBe(2);
    expect(aggregate.breakdown).toEqual([
      { tacticalPosition: "LCM", minutes: 20 },
      { tacticalPosition: "RCM", minutes: 10 },
    ]);
  });

  it("counts a match using two sided codes from the same profile group only once, never twice", () => {
    const appearances: ExactPositionAppearance[] = [
      { matchId: "m-1", tacticalPosition: "LCM", minutes: 15 },
      { matchId: "m-1", tacticalPosition: "RCM", minutes: 15 },
    ];
    const [aggregate] = aggregateExactAppearancesByProfile(appearances);
    expect(aggregate.totalMinutes).toBe(30);
    expect(aggregate.appearanceCount).toBe(1);
  });

  describe("flat 3x6 grid coordinates (PR #777 remediation)", () => {
    it("gives every one of the 14 profile positions its own unique grid cell", () => {
      const cellKeys = PROFILE_POSITIONS.map(profileFlatGridCellKey);
      expect(new Set(cellKeys).size).toBe(14);
    });

    it("never places LB on the same cell as LWB, or RB on the same cell as RWB", () => {
      expect(profileFlatGridCellKey("LB")).not.toBe(profileFlatGridCellKey("LWB"));
      expect(profileFlatGridCellKey("RB")).not.toBe(profileFlatGridCellKey("RWB"));
    });

    it("places GK alone on the bottom line and every other position on a line above it", () => {
      expect(PROFILE_FLAT_GRID.GK.line).toBe(5);
      for (const position of PROFILE_POSITIONS) {
        if (position === "GK") continue;
        expect(PROFILE_FLAT_GRID[position].line).toBeLessThan(5);
      }
    });

    it("places F alone on the top (attacking) line", () => {
      expect(PROFILE_FLAT_GRID.F.line).toBe(0);
      expect(PROFILE_FLAT_GRID.F.lane).toBe("CENTRE");
    });

    it("keeps LWB/DM/RWB on their own line above LB/CB/RB (defence)", () => {
      expect(PROFILE_FLAT_GRID.LWB.line).toBe(PROFILE_FLAT_GRID.DM.line);
      expect(PROFILE_FLAT_GRID.RWB.line).toBe(PROFILE_FLAT_GRID.DM.line);
      expect(PROFILE_FLAT_GRID.LB.line).toBeGreaterThan(PROFILE_FLAT_GRID.LWB.line);
      expect(PROFILE_FLAT_GRID.RB.line).toBeGreaterThan(PROFILE_FLAT_GRID.RWB.line);
    });
  });

  describe("vertical margin keeps dots off the pitch edge (PR #777 remediation, finding A06-1)", () => {
    it("never places a position's yPct at the bare 0% or 100% edge", () => {
      for (const position of PROFILE_POSITIONS) {
        const { yPct } = profilePositionToFlatPoint(position);
        expect(yPct).toBeGreaterThanOrEqual(PROFILE_GRID_VERTICAL_MARGIN_PCT);
        expect(yPct).toBeLessThanOrEqual(100 - PROFILE_GRID_VERTICAL_MARGIN_PCT);
      }
    });

    it("places F (top) and GK (bottom) exactly at the margin boundary, never past it", () => {
      expect(profilePositionToFlatPoint("F").yPct).toBe(PROFILE_GRID_VERTICAL_MARGIN_PCT);
      expect(profilePositionToFlatPoint("GK").yPct).toBe(100 - PROFILE_GRID_VERTICAL_MARGIN_PCT);
    });

    it("keeps the 6 lines evenly spaced between the margins (symmetric vertical spacing)", () => {
      const lineYs = [0, 1, 2, 3, 4, 5].map((line) => {
        const position = PROFILE_POSITIONS.find((p) => PROFILE_FLAT_GRID[p].line === line)!;
        return profilePositionToFlatPoint(position).yPct;
      });
      const gaps = lineYs.slice(1).map((y, i) => y - lineYs[i]);
      const [firstGap, ...restGaps] = gaps;
      for (const gap of restGaps) expect(gap).toBeCloseTo(firstGap, 5);
    });

    it("leaves enough margin to keep even the largest dot, its outline and glow fully inside the pitch at the smallest viewport this candidate is captured at (320px)", () => {
      // position-evidence-dot.tsx: STRONGEST-band diameter is 22px, glow blur up to 16px, outline
      // offset 2px -> worst-case visual half-extent from the dot's centre is ~29px.
      const WORST_CASE_DOT_HALF_EXTENT_PX = 29;
      // 320px viewport, after page padding the panel is ~288px wide; aspect-[3/5] -> ~480px tall.
      // Using a conservative lower bound in case of narrower future layouts.
      const SMALLEST_REALISTIC_PANEL_HEIGHT_PX = 420;
      const marginPx = (PROFILE_GRID_VERTICAL_MARGIN_PCT / 100) * SMALLEST_REALISTIC_PANEL_HEIGHT_PX;
      expect(marginPx).toBeGreaterThanOrEqual(WORST_CASE_DOT_HALF_EXTENT_PX);
    });
  });
});

function CANONICAL_TACTICAL_POSITION_COUNT(): number {
  return CANONICAL_TACTICAL_POSITIONS.length;
}
