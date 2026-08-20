import { describe, it, expect } from "vitest";
import { buildRoleStrength } from "../league-team-adapter";
import type { PlayerAttributeProfile } from "@/lib/events/event-types";

function makeAttributeProfile(overrides: Partial<PlayerAttributeProfile> = {}): PlayerAttributeProfile {
  return {
    playerId: "p1",
    firstName: "Test",
    lastName: null,
    coreTeamId: null,
    primaryPosition: "GK",
    secondaryPosition: null,
    tertiaryPosition: null,
    goalkeeperAbility: "YES",
    ballControl: null,
    passing: null,
    firstTouch: null,
    oneVOneAttacking: null,
    positioning: null,
    oneVOneDefending: null,
    decisionMaking: null,
    effort: null,
    teamplay: null,
    concentration: null,
    speed: null,
    strength: null,
    nonRotatable: false,
    preferredFoot: "RIGHT",
    bestSide: "CENTRE",
    ...overrides,
  };
}

describe("buildRoleStrength (Phase 9 audit §63)", () => {
  it("preserves null for an unrated goalkeeper-capable player instead of coercing to 0", () => {
    const profile = makeAttributeProfile({ goalkeeperAbility: "YES" });
    const roleStrength = buildRoleStrength(profile);
    expect(roleStrength.goalkeeper).toBeNull();
  });

  it("still computes a real goalkeeper role-strength value when the player has ratings", () => {
    const profile = makeAttributeProfile({
      goalkeeperAbility: "YES",
      decisionMaking: 8,
      positioning: 8,
      effort: 8,
      teamplay: 8,
      concentration: 8,
    });
    const roleStrength = buildRoleStrength(profile);
    expect(roleStrength.goalkeeper).not.toBeNull();
    expect(roleStrength.goalkeeper).toBeGreaterThan(0);
  });

  it("stays null (not 0) for a player without goalkeeper ability, same as before", () => {
    const profile = makeAttributeProfile({ goalkeeperAbility: "NO" });
    const roleStrength = buildRoleStrength(profile);
    expect(roleStrength.goalkeeper).toBeNull();
  });
});
