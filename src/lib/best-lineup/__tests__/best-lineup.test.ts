import { describe, it, expect } from 'vitest';
import { getPlayerSlotCompatibility, mapExistingPositionToBroad } from '@/lib/formations/lineup-compatibility';
import type { FormationSlotData, BroadPosition } from '@/lib/formations/types';

describe('Best Lineup - position-fit priority', () => {
  it('should prefer primary position fit over secondary', () => {
    const gkSlot: FormationSlotData = {
      id: 'slot-gk',
      gridX: 2,
      gridY: 5,
      label: 'GK',
      shortLabel: 'GK',
      roleType: 'GOALKEEPER',
      acceptedPositionIds: ['goalkeeper'] as BroadPosition[],
      sortOrder: 0,
    };

    const primaryGK = {
      playerId: 'p1',
      primaryPosition: 'GK',
      secondaryPositions: [],
    };

    const secondaryGK = {
      playerId: 'p2',
      primaryPosition: 'CB',
      secondaryPositions: ['GK'],
    };

    const result1 = getPlayerSlotCompatibility(primaryGK, gkSlot);
    const result2 = getPlayerSlotCompatibility(secondaryGK, gkSlot);

    expect(result1.isCompatible).toBe(true);
    expect(result2.isCompatible).toBe(true);
    expect(result1.compatibilityReason).toContain('Registered as');
  });

  it('should find compatible players for defender slots', () => {
    const defSlot: FormationSlotData = {
      id: 'slot-cb',
      gridX: 1,
      gridY: 3,
      label: 'CB',
      shortLabel: 'CB',
      roleType: 'DEFENDER',
      acceptedPositionIds: ['defender'] as BroadPosition[],
      sortOrder: 1,
    };

    const primaryDef = {
      playerId: 'p1',
      primaryPosition: 'CB',
      secondaryPositions: [],
    };

    const incompatible = {
      playerId: 'p2',
      primaryPosition: 'ST',
      secondaryPositions: [],
    };

    const result = getPlayerSlotCompatibility(primaryDef, defSlot);
    expect(result.isCompatible).toBe(true);

    const result2 = getPlayerSlotCompatibility(incompatible, defSlot);
    expect(result2.isCompatible).toBe(false);
  });

  it('should mark flexible players as compatible', () => {
    const midSlot: FormationSlotData = {
      id: 'slot-cm',
      gridX: 2,
      gridY: 3,
      label: 'CM',
      shortLabel: 'CM',
      roleType: 'MIDFIELDER',
      acceptedPositionIds: ['midfielder'] as BroadPosition[],
      sortOrder: 2,
    };

    const flexiblePlayer = {
      playerId: 'p1',
      primaryPosition: 'CM',
      secondaryPositions: ['CB', 'ST'],
    };

    const result = getPlayerSlotCompatibility(flexiblePlayer, midSlot);
    expect(result.isCompatible).toBe(true);
  });

  it('should map position codes to broad positions', () => {
    expect(mapExistingPositionToBroad('GK')).toBe('goalkeeper');
    expect(mapExistingPositionToBroad('CB')).toBe('defender');
    expect(mapExistingPositionToBroad('CM')).toBe('midfielder');
    expect(mapExistingPositionToBroad('ST')).toBe('forward');
  });

  it('should handle unknown positions as flexible', () => {
    expect(mapExistingPositionToBroad('Unknown')).toBe('flexible');
  });
});

describe('Best Lineup - deterministic selection', () => {
  it('should produce consistent results for identical inputs', () => {
    const gkSlot: FormationSlotData = {
      id: 'slot-gk',
      gridX: 2,
      gridY: 5,
      label: 'GK',
      shortLabel: 'GK',
      roleType: 'GOALKEEPER',
      acceptedPositionIds: ['goalkeeper'] as BroadPosition[],
      sortOrder: 0,
    };

    const gk = {
      playerId: 'gk1',
      primaryPosition: 'GK',
      secondaryPositions: [],
    };

    const result1 = getPlayerSlotCompatibility(gk, gkSlot);
    const result2 = getPlayerSlotCompatibility(gk, gkSlot);

    expect(result1.isCompatible).toBe(result2.isCompatible);
    expect(result1.compatibilityReason).toBe(result2.compatibilityReason);
  });
});

describe('Teams Excel Export - Sheet Name Sanitization', () => {
  it('should replace invalid characters in sheet names', () => {
    const invalidChars = /[\\*?/:[\]]/g;
    expect('Team: A'.replace(invalidChars, '')).toBe('Team A');
    expect('Team/B'.replace(invalidChars, '')).toBe('TeamB');
    expect('Team*1'.replace(invalidChars, '')).toBe('Team1');
  });

  it('should truncate long sheet names', () => {
    const longName = 'A'.repeat(40);
    expect(longName.substring(0, 31).length).toBe(31);
  });
});