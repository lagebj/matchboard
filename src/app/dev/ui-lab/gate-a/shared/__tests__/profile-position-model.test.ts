import { describe, it, expect } from "vitest";
import { CANONICAL_TACTICAL_POSITIONS } from "@/domain/positions/roles";
import {
  PROFILE_POSITIONS,
  PROFILE_TO_TACTICAL_GROUP,
  collapseTacticalToProfile,
  allCanonicalTacticalPositionsCovered,
  aggregateExactAppearancesByProfile,
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
});

function CANONICAL_TACTICAL_POSITION_COUNT(): number {
  return CANONICAL_TACTICAL_POSITIONS.length;
}
