import { describe, it, expect } from 'vitest';
import type { PlayerAttributeProfile } from '../event-types';
import { computeEventSquadFillPlan, type FillSquadInput } from '../event-squad-fill';

function makePlayer(overrides: Partial<PlayerAttributeProfile> = {}): PlayerAttributeProfile {
  const defaults: PlayerAttributeProfile = {
    playerId: 'p1',
    firstName: 'Player',
    lastName: 'One',
    coreTeamId: null,
    primaryPosition: 'CM',
    secondaryPosition: null,
    tertiaryPosition: null,
    goalkeeperAbility: 'NO',
    ballControl: 6,
    passing: 6,
    firstTouch: 6,
    oneVOneAttacking: 6,
    positioning: 6,
    oneVOneDefending: 6,
    decisionMaking: 6,
    effort: 6,
    teamplay: 6,
    concentration: 6,
    speed: 6,
    strength: 6,
    nonRotatable: false,
    preferredFoot: 'RIGHT',
    bestSide: 'RIGHT',
  };
  return { ...defaults, ...overrides };
}

function makePlayers(count: number, prefix = 'u'): PlayerAttributeProfile[] {
  return Array.from({ length: count }, (_, i) => makePlayer({ playerId: `${prefix}${i + 1}` }));
}

function squad(overrides: Partial<FillSquadInput> & { squadId: string }): FillSquadInput {
  return {
    generationOrder: 0,
    currentCount: 0,
    targetSize: 9,
    minSize: null,
    maxSize: null,
    hasGoalkeeper: true,
    ...overrides,
  };
}

describe('computeEventSquadFillPlan — mandatory fixtures (TEST-MATRIX.md §5)', () => {
  it('Fixture A: exact residual — targets 12/9/9, current 11/5/5, 9 unassigned -> additions 1/4/4', () => {
    const squads: FillSquadInput[] = [
      squad({ squadId: 's1', generationOrder: 0, targetSize: 12, currentCount: 11 }),
      squad({ squadId: 's2', generationOrder: 1, targetSize: 9, currentCount: 5 }),
      squad({ squadId: 's3', generationOrder: 2, targetSize: 9, currentCount: 5 }),
    ];
    const plan = computeEventSquadFillPlan(squads, makePlayers(9));

    const bySquad = (id: string) => plan.squadResults.find((r) => r.squadId === id)!;
    expect(bySquad('s1').additions).toBe(1);
    expect(bySquad('s2').additions).toBe(4);
    expect(bySquad('s3').additions).toBe(4);
    expect(bySquad('s1').finalCount).toBe(12);
    expect(bySquad('s2').finalCount).toBe(9);
    expect(bySquad('s3').finalCount).toBe(9);
    expect(plan.unassignedPlayerIds).toHaveLength(0);
    expect(plan.notes).toHaveLength(0);
  });

  it('Fixture B: one squad already at target — targets 10/10/10, current 10/6/6, 8 unassigned -> 0/4/4', () => {
    const squads: FillSquadInput[] = [
      squad({ squadId: 's1', generationOrder: 0, targetSize: 10, currentCount: 10 }),
      squad({ squadId: 's2', generationOrder: 1, targetSize: 10, currentCount: 6 }),
      squad({ squadId: 's3', generationOrder: 2, targetSize: 10, currentCount: 6 }),
    ];
    const plan = computeEventSquadFillPlan(squads, makePlayers(8));

    const bySquad = (id: string) => plan.squadResults.find((r) => r.squadId === id)!;
    expect(bySquad('s1').additions).toBe(0);
    expect(bySquad('s2').additions).toBe(4);
    expect(bySquad('s3').additions).toBe(4);
  });

  it('Fixture C: one squad already above target — targets 9/9/9, current 10/5/5, 8 unassigned -> 0/4/4', () => {
    const squads: FillSquadInput[] = [
      squad({ squadId: 's1', generationOrder: 0, targetSize: 9, currentCount: 10 }),
      squad({ squadId: 's2', generationOrder: 1, targetSize: 9, currentCount: 5 }),
      squad({ squadId: 's3', generationOrder: 2, targetSize: 9, currentCount: 5 }),
    ];
    const plan = computeEventSquadFillPlan(squads, makePlayers(8));

    const bySquad = (id: string) => plan.squadResults.find((r) => r.squadId === id)!;
    expect(bySquad('s1').additions).toBe(0);
    expect(bySquad('s2').additions).toBe(4);
    expect(bySquad('s3').additions).toBe(4);
    // The already-above-target squad's existing 10 players are untouched, not trimmed to 9.
    expect(bySquad('s1').finalCount).toBe(10);
  });

  it("Fixture D: different maxima — each squad's own max is used, never a shared/first-squad value", () => {
    const squads: FillSquadInput[] = [
      squad({ squadId: 's1', generationOrder: 0, targetSize: 9, maxSize: 10, currentCount: 9 }),
      squad({ squadId: 's2', generationOrder: 1, targetSize: 9, maxSize: 14, currentCount: 9 }),
      squad({ squadId: 's3', generationOrder: 2, targetSize: 9, maxSize: 9, currentCount: 9 }),
    ];
    // All squads already at target; 5 surplus players should distribute only up to each squad's
    // OWN max — s1 can take 1 more (10 max), s2 can take 5 more (14 max) but only 4 are left
    // after s1/s3, s3 can take 0 more (9 max, already at target=max).
    const plan = computeEventSquadFillPlan(squads, makePlayers(5));

    const bySquad = (id: string) => plan.squadResults.find((r) => r.squadId === id)!;
    expect(bySquad('s1').finalCount).toBeLessThanOrEqual(10);
    expect(bySquad('s3').finalCount).toBe(9);
    expect(bySquad('s3').additions).toBe(0);
    // No squad ever exceeds its own max.
    for (const s of squads) {
      const result = bySquad(s.squadId);
      expect(result.finalCount).toBeLessThanOrEqual(s.maxSize!);
    }
  });

  it('Fixture E: insufficient players — hard minimums and coverage are honored first, shortage is explained', () => {
    const squads: FillSquadInput[] = [
      squad({ squadId: 's1', generationOrder: 0, targetSize: 12, minSize: 9, currentCount: 3 }),
      squad({ squadId: 's2', generationOrder: 1, targetSize: 9, minSize: 7, currentCount: 3 }),
    ];
    // Total residual to target = 9 + 6 = 15, but only 10 players exist -> scarcity.
    const plan = computeEventSquadFillPlan(squads, makePlayers(10));

    const bySquad = (id: string) => plan.squadResults.find((r) => r.squadId === id)!;
    // Both squads reach at least their hard minimum before either exceeds it toward target.
    expect(bySquad('s1').finalCount).toBeGreaterThanOrEqual(9);
    expect(bySquad('s2').finalCount).toBeGreaterThanOrEqual(7);
    expect(plan.unassignedPlayerIds).toHaveLength(0);
    expect(plan.notes.some((n) => n.includes('below target'))).toBe(true);
  });

  it('Fixture F: surplus players — targets fill first, no max exceeded, remainder explained as unassigned', () => {
    const squads: FillSquadInput[] = [
      squad({ squadId: 's1', generationOrder: 0, targetSize: 9, maxSize: 9, currentCount: 9 }),
      squad({ squadId: 's2', generationOrder: 1, targetSize: 9, maxSize: 9, currentCount: 9 }),
    ];
    const plan = computeEventSquadFillPlan(squads, makePlayers(3));

    expect(plan.additions).toHaveLength(0);
    expect(plan.unassignedPlayerIds).toHaveLength(3);
    expect(plan.notes.some((n) => n.includes('unassigned'))).toBe(true);
  });

  it('Fixture G: goalkeeper coverage can steer which player fills a slot, without adding extra players to an at-target squad', () => {
    const squads: FillSquadInput[] = [
      squad({ squadId: 's1', generationOrder: 0, targetSize: 9, currentCount: 8, hasGoalkeeper: true }),
      squad({ squadId: 's2', generationOrder: 1, targetSize: 9, currentCount: 8, hasGoalkeeper: false }),
    ];
    const gk = makePlayer({ playerId: 'gk1', goalkeeperAbility: 'YES', primaryPosition: 'GK' });
    const outfield = makePlayer({ playerId: 'out1' });
    const plan = computeEventSquadFillPlan(squads, [outfield, gk]);

    // s2 (no GK) gets the goalkeeper; s1 gets the outfield player. Each squad still receives
    // exactly one addition (its own residual), not two.
    const s2Addition = plan.additions.find((a) => a.squadId === 's2');
    expect(s2Addition?.playerId).toBe('gk1');
    expect(plan.squadResults.find((r) => r.squadId === 's1')!.additions).toBe(1);
    expect(plan.squadResults.find((r) => r.squadId === 's2')!.additions).toBe(1);
  });

  it('never moves an existing assignment — additions only ever reference the unassigned pool', () => {
    const squads: FillSquadInput[] = [
      squad({ squadId: 's1', generationOrder: 0, targetSize: 5, currentCount: 5 }),
      squad({ squadId: 's2', generationOrder: 1, targetSize: 5, currentCount: 2 }),
    ];
    const plan = computeEventSquadFillPlan(squads, makePlayers(3));

    expect(plan.additions.every((a) => a.squadId === 's2')).toBe(true);
    expect(plan.squadResults.find((r) => r.squadId === 's1')!.additions).toBe(0);
  });
});
