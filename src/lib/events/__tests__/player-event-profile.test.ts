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
    ballControl: 3,
    passing: 4,
    firstTouch: 3,
    oneVOneAttacking: 2,
    positioning: 4,
    oneVOneDefending: 3,
    decisionMaking: 4,
    effort: 5,
    teamplay: 3,
    concentration: 3,
    speed: 4,
    strength: 3,
    nonRotatable: false,
    preferredFoot: 'RIGHT' as const,
    bestSide: 'RIGHT' as const,
  };

  it('maps all player attributes correctly', () => {
    const profile = toPlayerAttributeProfile(basePlayer);
    expect(profile.playerId).toBe('p1');
    expect(profile.firstName).toBe('Test');
    expect(profile.ballControl).toBe(3);
    expect(profile.passing).toBe(4);
    expect(profile.effort).toBe(5);
    expect(profile.goalkeeperAbility).toBe('NO');
    expect(profile.primaryPosition).toBe('CM');
  });

  it('preserves null ratings as null', () => {
    const profile = toPlayerAttributeProfile({ ...basePlayer, ballControl: null, passing: null });
    expect(profile.ballControl).toBeNull();
    expect(profile.passing).toBeNull();
    expect(profile.effort).toBe(5);
  });

  it('normalizes out-of-range ratings to null', () => {
    const profile = toPlayerAttributeProfile({ ...basePlayer, ballControl: 0, passing: 6, effort: -1 });
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