import { describe, it, expect } from 'vitest';
import { toPlayerAttributeProfile } from '../player-event-profile';

describe('toPlayerAttributeProfile', () => {
  const basePlayer = {
    id: 'p1',
    firstName: 'Test',
    lastName: 'Player',
    coreTeamId: 't1',
    primaryPosition: 'CM',
    secondaryPosition: 'DM',
    tertiaryPosition: 'AM',
    goalkeeperAbility: 'NO',
    ballControl: 6,
    passing: 8,
    firstTouch: 6,
    oneVOneAttacking: 4,
    positioning: 8,
    oneVOneDefending: 6,
    decisionMaking: 8,
    effort: 10,
    teamplay: 6,
    concentration: 6,
    speed: 8,
    strength: 6,
    nonRotatable: false,
    preferredFoot: 'RIGHT' as const,
    bestSide: 'RIGHT' as const,
  };

  it('maps all player attributes correctly', () => {
    const profile = toPlayerAttributeProfile(basePlayer);
    expect(profile.playerId).toBe('p1');
    expect(profile.firstName).toBe('Test');
    expect(profile.ballControl).toBe(6);
    expect(profile.passing).toBe(8);
    expect(profile.effort).toBe(10);
    expect(profile.goalkeeperAbility).toBe('NO');
    expect(profile.primaryPosition).toBe('CM');
  });

  it('preserves null ratings as null', () => {
    const profile = toPlayerAttributeProfile({ ...basePlayer, ballControl: null, passing: null });
    expect(profile.ballControl).toBeNull();
    expect(profile.passing).toBeNull();
    expect(profile.effort).toBe(10);
  });

  it('normalizes out-of-range ratings to null', () => {
    const profile = toPlayerAttributeProfile({ ...basePlayer, ballControl: 0, passing: 11, effort: -1 });
    expect(profile.ballControl).toBeNull();
    expect(profile.passing).toBeNull();
    expect(profile.effort).toBeNull();
  });

  it('defaults missing position to flexible', () => {
    const profile = toPlayerAttributeProfile({ ...basePlayer, primaryPosition: null });
    expect(profile.primaryPosition).toBe('flexible');
  });

  it('defaults missing goalkeeperAbility to NO', () => {
    const profile = toPlayerAttributeProfile({ ...basePlayer, goalkeeperAbility: null });
    expect(profile.goalkeeperAbility).toBe('NO');
  });

  it('defaults nonRotatable to false', () => {
    const profile = toPlayerAttributeProfile({ ...basePlayer, nonRotatable: null });
    expect(profile.nonRotatable).toBe(false);
  });
});