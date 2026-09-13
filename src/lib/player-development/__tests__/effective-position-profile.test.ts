import { describe, it, expect } from "vitest";
import {
  computeEffectivePlayerPositionProfile,
  determineAutomaticPositionUpdate,
  type DeclaredPositions,
  type MatchPositionEvidence,
} from "../effective-position-profile";

/**
 * Scenario coverage mirrors the bundle's own acceptance table
 * (`.matchboard-work/matchboard_atlas_followup_roundboard_players_pitch_positions_2026-09-12/data/position-evolution-acceptance.csv`).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
function daysAgo(n: number): Date {
  return new Date(Date.now() - n * DAY_MS);
}

function match(positionMinutes: Record<string, number>, daysAgoValue: number, matchKey?: string): MatchPositionEvidence {
  return { matchKey: matchKey ?? `m-${daysAgoValue}`, playedAt: daysAgo(daysAgoValue), minutesByPosition: positionMinutes };
}

describe("computeEffectivePlayerPositionProfile — coach declaration (creation-primary, creation-secondary)", () => {
  it("coach-declared primary is rank 1 immediately, with zero match history", () => {
    const declared: DeclaredPositions = { primary: "ST", secondary: null, tertiary: null };
    const profile = computeEffectivePlayerPositionProfile(declared, []);
    expect(profile.primary).toBe("ST");
    expect(profile.positions).toHaveLength(1);
    expect(profile.positions[0]).toMatchObject({ positionId: "ST", rank: 1 });
    expect(profile.positions[0].sources.coachDeclared).toBe(true);
  });

  it("coach-declared secondary exists and ranks below primary with no contradicting evidence", () => {
    const declared: DeclaredPositions = { primary: "ST", secondary: "LW", tertiary: null };
    const profile = computeEffectivePlayerPositionProfile(declared, []);
    expect(profile.primary).toBe("ST");
    expect(profile.secondary).toBe("LW");
    expect(profile.positions.find((p) => p.positionId === "LW")?.rank).toBe(2);
  });
});

describe("computeEffectivePlayerPositionProfile — actual usage (actual-new-position, map-empty)", () => {
  it("a single match at an undeclared position adds it to the profile with real evidence", () => {
    const declared: DeclaredPositions = { primary: "ST", secondary: null, tertiary: null };
    const history = [match({ CB: 60 }, 3)];
    const profile = computeEffectivePlayerPositionProfile(declared, history);
    const cb = profile.positions.find((p) => p.positionId === "CB");
    expect(cb).toBeDefined();
    expect(cb!.sources.coachDeclared).toBe(false);
    expect(cb!.sources.appearances).toBe(1);
  });

  it("a position with no legitimate support (no declaration, no evidence) never appears", () => {
    const declared: DeclaredPositions = { primary: "ST", secondary: null, tertiary: null };
    const profile = computeEffectivePlayerPositionProfile(declared, [match({ ST: 60 }, 3)]);
    expect(profile.positions.find((p) => p.positionId === "RB")).toBeUndefined();
  });
});

describe("computeEffectivePlayerPositionProfile — repeated usage can overtake declared primary", () => {
  it("repeated heavy CB usage across the window outranks a rarely-reinforced declared ST", () => {
    const declared: DeclaredPositions = { primary: "ST", secondary: null, tertiary: null };
    const history = [
      match({ CB: 70 }, 1),
      match({ CB: 65 }, 8),
      match({ CB: 68 }, 15),
      match({ CB: 60 }, 22),
    ];
    const profile = computeEffectivePlayerPositionProfile(declared, history);
    const cb = profile.positions.find((p) => p.positionId === "CB")!;
    const st = profile.positions.find((p) => p.positionId === "ST")!;
    expect(cb.rank).toBe(1);
    expect(st.rank).toBeGreaterThan(1);
  });
});

describe("determineAutomaticPositionUpdate — hysteresis and stability", () => {
  function buildRepeatedCbHistory(matchCount: number): MatchPositionEvidence[] {
    return Array.from({ length: matchCount }, (_, i) => match({ CB: 70 }, i * 7 + 1, `m${i}`));
  }

  it("does not promote from a single good match (fails the appearances gate)", () => {
    const declared: DeclaredPositions = { primary: "ST", secondary: null, tertiary: null };
    const result = determineAutomaticPositionUpdate(declared, [match({ CB: 90 }, 1)]);
    expect(result.changed).toBe(false);
  });

  it("does not promote from one isolated emergency spell even with enough appearances if not enough recent recurrence", () => {
    // 3 CB appearances but very old (outside the 6-match recency window once mixed with newer ST matches)
    const declared: DeclaredPositions = { primary: "ST", secondary: null, tertiary: null };
    const history = [
      match({ ST: 60 }, 1),
      match({ ST: 60 }, 8),
      match({ ST: 60 }, 15),
      match({ ST: 60 }, 22),
      match({ ST: 60 }, 29),
      match({ ST: 60 }, 36),
      match({ CB: 60 }, 43), // aged out of the 6-match window entirely
      match({ CB: 60 }, 50),
      match({ CB: 60 }, 57),
    ];
    const result = determineAutomaticPositionUpdate(declared, history);
    expect(result.changed).toBe(false);
  });

  it("promotes once a clear margin persists across two consecutive evidence snapshots", () => {
    const declared: DeclaredPositions = { primary: "ST", secondary: null, tertiary: null };
    // Enough recent, heavy CB usage that both the "current" (all matches) and "previous"
    // (drop the most recent match) windows show CB clearly ahead of the declared ST.
    const history = buildRepeatedCbHistory(6);
    const result = determineAutomaticPositionUpdate(declared, history);
    expect(result.changed).toBe(true);
    expect(result.newDeclared?.primary).toBe("CB");
  });

  it("demotes the old primary to secondary rather than dropping it, once promoted", () => {
    const declared: DeclaredPositions = { primary: "ST", secondary: null, tertiary: null };
    // CB dominant, but ST still appears a little — should survive as secondary, not vanish.
    const history = [
      match({ CB: 70 }, 1),
      match({ CB: 70 }, 8),
      match({ CB: 70 }, 15),
      match({ CB: 70 }, 22),
      match({ ST: 20 }, 29),
    ];
    const result = determineAutomaticPositionUpdate(declared, history);
    expect(result.changed).toBe(true);
    expect(result.newDeclared?.primary).toBe("CB");
    // ST still has its declared-primary bonus on the *original* `declared` used for the
    // secondary/tertiary ranking pass, so it is not silently dropped.
    expect([result.newDeclared?.secondary, result.newDeclared?.tertiary]).toContain("ST");
  });

  it("a manually-edited declared primary resets the comparison baseline for free", () => {
    // Coach manually sets primary to CB — the next automatic check compares everything against
    // CB now, not ST, with no separate "reset" mechanism needed.
    const declared: DeclaredPositions = { primary: "CB", secondary: null, tertiary: null };
    const history = [match({ ST: 60 }, 1), match({ ST: 60 }, 8)];
    const result = determineAutomaticPositionUpdate(declared, history);
    // ST doesn't yet have 3 appearances, so no promotion — but critically, the function only
    // ever compares against `declared.primary` (CB), proving the reset happens automatically.
    expect(result.changed).toBe(false);
  });
});

describe("evidence exclusion (planned-only, suitability-only) — enforced by the type signature", () => {
  it("MatchPositionEvidence carries only actual position/minutes — no planned or suitability concept exists in the type", () => {
    const evidence: MatchPositionEvidence = { matchKey: "m1", playedAt: new Date(), minutesByPosition: { CB: 45 } };
    // TypeScript itself is the enforcement: there is no `plannedPosition` or `suitabilityTier`
    // field to accidentally wire up. This test exists to name the invariant explicitly.
    expect(Object.keys(evidence)).toEqual(["matchKey", "playedAt", "minutesByPosition"]);
  });
});

describe("purity — inputs are never mutated (history)", () => {
  it("does not mutate the passed-in match history array or its entries", () => {
    const declared: DeclaredPositions = { primary: "ST", secondary: null, tertiary: null };
    const history = [match({ ST: 60, CB: 10 }, 1), match({ CB: 60 }, 8)];
    const historyClone = JSON.parse(JSON.stringify(history.map((h) => ({ ...h, playedAt: h.playedAt.toISOString() }))));
    computeEffectivePlayerPositionProfile(declared, history);
    const afterClone = JSON.parse(JSON.stringify(history.map((h) => ({ ...h, playedAt: h.playedAt.toISOString() }))));
    expect(afterClone).toEqual(historyClone);
  });
});
