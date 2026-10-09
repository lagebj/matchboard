import { describe, it, expect } from "vitest";
import { CANONICAL_TACTICAL_POSITIONS } from "@/domain/positions/roles";
import {
  PROFILE_POSITIONS,
  PROFILE_TO_TACTICAL_GROUP,
  PROFILE_FLAT_GRID,
  collapseTacticalToProfile,
  allCanonicalTacticalPositionsCovered,
  aggregateExactAppearancesByProfile,
  profileFlatGridCellKey,
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
});

function CANONICAL_TACTICAL_POSITION_COUNT(): number {
  return CANONICAL_TACTICAL_POSITIONS.length;
}
