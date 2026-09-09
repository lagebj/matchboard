import { describe, expect, it } from "vitest";
import { validateEventPool } from "../event-validation";
import type { PlayerAttributeProfile } from "../event-types";

function makePlayer(overrides: Partial<PlayerAttributeProfile> = {}): PlayerAttributeProfile {
  return {
    playerId: "p1",
    firstName: "P",
    lastName: null,
    coreTeamId: null,
    primaryPosition: "CM",
    secondaryPosition: null,
    tertiaryPosition: null,
    goalkeeperAbility: "NO",
    ballControl: 6, passing: 6, firstTouch: 6, oneVOneAttacking: 6, positioning: 6,
    oneVOneDefending: 6, decisionMaking: 6, effort: 6, teamplay: 6, concentration: 6,
    speed: 6, strength: 6,
    nonRotatable: false,
    preferredFoot: "RIGHT",
    bestSide: "CENTER",
    ...overrides,
  };
}

// gridX lanes: 0–1 LEFT, 2 CENTRE, 3–4 RIGHT. A 5-a-side-ish shape with two wide slots.
const SLOTS_WITH_GEOMETRY = [
  { roleType: "GOALKEEPER", acceptedPositions: ["goalkeeper" as const], label: "GK", gridX: 2 },
  { roleType: "DEFENDER", acceptedPositions: ["defender" as const], label: "LB", gridX: 0 },
  { roleType: "DEFENDER", acceptedPositions: ["defender" as const], label: "RB", gridX: 4 },
  { roleType: "MIDFIELDER", acceptedPositions: ["midfielder" as const], label: "CM", gridX: 2 },
  { roleType: "FORWARD", acceptedPositions: ["forward" as const], label: "ST", gridX: 2 },
];

describe("validateEventPool — exact formation coverage (ADR-0129 §12)", () => {
  it("returns null exact coverage when the formation slots carry no geometry", () => {
    const players = Array.from({ length: 10 }, (_, i) => makePlayer({ playerId: `p${i}` }));
    const result = validateEventPool(players, 2, 5, "FIVE_A_SIDE", [
      { roleType: "MIDFIELDER", acceptedPositions: ["midfielder"], label: "CM" },
    ]);
    expect(result.exactFormationCoverage).toBeNull();
  });

  it("computes exact simultaneous coverage across squads when slots have geometry", () => {
    // Two squads' worth of exact roles: GK×2, LB×2, RB×2, CM×2, ST×2.
    const players = [
      makePlayer({ playerId: "g1", primaryPosition: "GK", goalkeeperAbility: "YES" }),
      makePlayer({ playerId: "g2", primaryPosition: "GK", goalkeeperAbility: "YES" }),
      makePlayer({ playerId: "lb1", primaryPosition: "LB" }),
      makePlayer({ playerId: "lb2", primaryPosition: "LB" }),
      makePlayer({ playerId: "rb1", primaryPosition: "RB" }),
      makePlayer({ playerId: "rb2", primaryPosition: "RB" }),
      makePlayer({ playerId: "cm1", primaryPosition: "CM" }),
      makePlayer({ playerId: "cm2", primaryPosition: "CM" }),
      makePlayer({ playerId: "st1", primaryPosition: "ST" }),
      makePlayer({ playerId: "st2", primaryPosition: "ST" }),
    ];
    const result = validateEventPool(players, 2, 5, "FIVE_A_SIDE", SLOTS_WITH_GEOMETRY);
    expect(result.exactFormationCoverage).not.toBeNull();
    expect(result.exactFormationCoverage!.covered).toBe(true);
    expect(result.exactFormationCoverage!.requiredExactSlots).toBe(10);
  });

  it("flags the exact role that cannot be staffed across all squads, and warns", () => {
    // Only one true left-back for two squads; nobody else is eligible for LB.
    const players = [
      makePlayer({ playerId: "g1", primaryPosition: "GK", goalkeeperAbility: "YES" }),
      makePlayer({ playerId: "g2", primaryPosition: "GK", goalkeeperAbility: "YES" }),
      makePlayer({ playerId: "lb1", primaryPosition: "LB" }),
      makePlayer({ playerId: "rb1", primaryPosition: "RB" }),
      makePlayer({ playerId: "rb2", primaryPosition: "RB" }),
      makePlayer({ playerId: "cm1", primaryPosition: "CM" }),
      makePlayer({ playerId: "cm2", primaryPosition: "CM" }),
      makePlayer({ playerId: "st1", primaryPosition: "ST" }),
      makePlayer({ playerId: "st2", primaryPosition: "ST" }),
      makePlayer({ playerId: "am1", primaryPosition: "AM" }), // AM→LB is 30 → DEVELOPMENTAL, not eligible
    ];
    const result = validateEventPool(players, 2, 5, "FIVE_A_SIDE", SLOTS_WITH_GEOMETRY);
    expect(result.exactFormationCoverage!.covered).toBe(false);
    expect(result.exactFormationCoverage!.unfilledRoles.some((r) => r.role === "LB")).toBe(true);
    expect(result.warnings.some((w) => /LB role across 2 squads/.test(w))).toBe(true);
  });
});
