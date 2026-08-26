import { describe, it, expect } from 'vitest';
import {
  validatePlannedChanges,
  projectPlannedLineup,
  projectPlannedMinutes,
  checkPlannedRotationCoverage,
  type PlannedRotationChangeData,
} from '../planned-rotation';

describe('validatePlannedChanges', () => {
  const playerIds = new Set(['p1', 'p2', 'p3', 'p4', 'p5']);

  it('returns empty errors for valid substitution changes', () => {
    const changes: PlannedRotationChangeData[] = [
      { outPlayerId: 'p1', inPlayerId: 'p3', outPosition: 'CM', inPosition: 'CM', positionOnly: false, approximateMatchSeconds: 1500, notes: null },
      { outPlayerId: 'p2', inPlayerId: 'p4', outPosition: 'FW', inPosition: 'FW', positionOnly: false, approximateMatchSeconds: 2400, notes: null },
    ];
    const errors = validatePlannedChanges(changes, playerIds);
    expect(errors).toEqual([]);
  });

  it('returns empty errors for valid position-only changes', () => {
    const changes: PlannedRotationChangeData[] = [
      { outPlayerId: 'p1', inPlayerId: 'p2', outPosition: 'CM', inPosition: 'FW', positionOnly: true, approximateMatchSeconds: 1500, notes: null },
    ];
    const errors = validatePlannedChanges(changes, playerIds);
    expect(errors).toEqual([]);
  });

  it('rejects substitution without outPlayerId', () => {
    const changes: PlannedRotationChangeData[] = [
      { outPlayerId: null, inPlayerId: 'p3', outPosition: null, inPosition: 'CM', positionOnly: false, approximateMatchSeconds: 1500, notes: null },
    ];
    const errors = validatePlannedChanges(changes, playerIds);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('player going out');
  });

  it('rejects substitution without inPlayerId', () => {
    const changes: PlannedRotationChangeData[] = [
      { outPlayerId: 'p1', inPlayerId: null, outPosition: 'CM', inPosition: null, positionOnly: false, approximateMatchSeconds: 1500, notes: null },
    ];
    const errors = validatePlannedChanges(changes, playerIds);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('coming in');
  });

  it('rejects position-only swap with same player', () => {
    const changes: PlannedRotationChangeData[] = [
      { outPlayerId: 'p1', inPlayerId: 'p1', outPosition: 'CM', inPosition: 'FW', positionOnly: true, approximateMatchSeconds: 1500, notes: null },
    ];
    const errors = validatePlannedChanges(changes, playerIds);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('same player');
  });

  it('rejects out player not in squad', () => {
    const changes: PlannedRotationChangeData[] = [
      { outPlayerId: 'unknown', inPlayerId: 'p3', outPosition: 'CM', inPosition: 'CM', positionOnly: false, approximateMatchSeconds: 1500, notes: null },
    ];
    const errors = validatePlannedChanges(changes, playerIds);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('not in the match squad');
  });

  it('rejects in player not in squad', () => {
    const changes: PlannedRotationChangeData[] = [
      { outPlayerId: 'p1', inPlayerId: 'unknown', outPosition: 'CM', inPosition: 'CM', positionOnly: false, approximateMatchSeconds: 1500, notes: null },
    ];
    const errors = validatePlannedChanges(changes, playerIds);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('not in the match squad');
  });

  it('rejects exceeding max changes', () => {
    const changes = Array.from({ length: 51 }, (_, i) => ({
      outPlayerId: 'p1',
      inPlayerId: 'p2',
      outPosition: 'CM',
      inPosition: 'CM',
      positionOnly: false,
      approximateMatchSeconds: 1500 + i * 100,
      notes: null,
    }));
    const errors = validatePlannedChanges(changes, playerIds);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Maximum');
  });
});

describe('projectPlannedLineup', () => {
  const starters = [
    { playerId: 'gk1', position: 'GK' },
    { playerId: 'df1', position: 'CB' },
    { playerId: 'df2', position: 'CB' },
    { playerId: 'mf1', position: 'CM' },
    { playerId: 'mf2', position: 'CM' },
    { playerId: 'fw1', position: 'FW' },
  ];

  it('returns starting lineup when no changes apply', () => {
    const result = projectPlannedLineup(starters, [], 0);
    expect(result.get('gk1')).toEqual({ position: 'GK', onPitch: true });
    expect(result.get('fw1')).toEqual({ position: 'FW', onPitch: true });
  });

  it('applies substitution at the correct time', () => {
    const changes = [
      { outPlayerId: 'mf1', inPlayerId: 'mf3', outPosition: 'CM', inPosition: 'CM', positionOnly: false, approximateMatchSeconds: 1500 },
    ];
    const result = projectPlannedLineup(starters, changes, 2000);
    expect(result.get('mf1')).toEqual({ position: 'CM', onPitch: false });
    expect(result.get('mf3')).toEqual({ position: 'CM', onPitch: true });
  });

  it('does not apply substitution before its time', () => {
    const changes = [
      { outPlayerId: 'mf1', inPlayerId: 'mf3', outPosition: 'CM', inPosition: 'CM', positionOnly: false, approximateMatchSeconds: 1500 },
    ];
    const result = projectPlannedLineup(starters, changes, 1000);
    expect(result.get('mf1')).toEqual({ position: 'CM', onPitch: true });
    expect(result.get('mf3')).toBeUndefined();
  });

  it('applies position-only swap', () => {
    const changes = [
      { outPlayerId: 'mf1', inPlayerId: 'mf2', outPosition: 'CM', inPosition: 'FW', positionOnly: true, approximateMatchSeconds: 1500 },
    ];
    const result = projectPlannedLineup(starters, changes, 2000);
    expect(result.get('mf1')).toEqual({ position: 'FW', onPitch: true });
    expect(result.get('mf2')).toEqual({ position: 'CM', onPitch: true });
  });

  it('handles multiple substitutions in order', () => {
    const changes = [
      { outPlayerId: 'mf1', inPlayerId: 'mf3', outPosition: 'CM', inPosition: 'CM', positionOnly: false, approximateMatchSeconds: 1500 },
      { outPlayerId: 'fw1', inPlayerId: 'mf1', outPosition: 'FW', inPosition: 'FW', positionOnly: false, approximateMatchSeconds: 2500 },
    ];
    const result = projectPlannedLineup(starters, changes, 3000);
    expect(result.get('mf1')).toEqual({ position: 'FW', onPitch: true });
    expect(result.get('fw1')).toEqual({ position: 'FW', onPitch: false });
    expect(result.get('mf3')).toEqual({ position: 'CM', onPitch: true });
  });
});

describe('projectPlannedMinutes', () => {
  const starters = [
    { playerId: 'gk1', position: 'GK' },
    { playerId: 'df1', position: 'CB' },
    { playerId: 'mf1', position: 'CM' },
    { playerId: 'fw1', position: 'FW' },
  ];
  const totalMatchSeconds = 50 * 60;

  it('returns full match minutes for starters with no changes', () => {
    const projections = projectPlannedMinutes(starters, [], totalMatchSeconds);
    for (const p of projections) {
      expect(p.plannedMinutes).toBe(50);
    }
  });

  it('calculates reduced minutes for substituted players', () => {
    const changes = [
      { outPlayerId: 'mf1', inPlayerId: 'mf2', outPosition: 'CM', inPosition: 'CM', positionOnly: false, approximateMatchSeconds: 25 * 60 },
    ];
    const projections = projectPlannedMinutes(starters, changes, totalMatchSeconds);

    const mf1 = projections.find((p) => p.playerId === 'mf1')!;
    expect(mf1.plannedMinutes).toBe(25);

    const mf2 = projections.find((p) => p.playerId === 'mf2')!;
    expect(mf2.plannedMinutes).toBe(25);
  });

  it('excludes bench time from planned minutes', () => {
    const changes = [
      { outPlayerId: 'mf1', inPlayerId: 'mf2', outPosition: 'CM', inPosition: 'CM', positionOnly: false, approximateMatchSeconds: 25 * 60 },
    ];
    const projections = projectPlannedMinutes(starters, changes, totalMatchSeconds);

    const mf1 = projections.find((p) => p.playerId === 'mf1')!;
    const benchPositions = mf1.positions.filter((p) => p.position === 'BENCH');
    expect(benchPositions).toHaveLength(0);
  });
});

describe('checkPlannedRotationCoverage', () => {
  const starters = [
    { playerId: 'gk1', position: 'GK' },
    { playerId: 'df1', position: 'CB' },
    { playerId: 'mf1', position: 'CM' },
    { playerId: 'fw1', position: 'FW' },
  ];
  const squadPlayerIds = new Set(['gk1', 'df1', 'mf1', 'fw1', 'mf2', 'df2']);
  const options = { totalMatchSeconds: 50 * 60, minimumOnPitch: 4, positions: ['GK', 'CB', 'CM', 'FW'] };

  it('reports no issues for valid starting lineup', () => {
    const issues = checkPlannedRotationCoverage(starters, [], squadPlayerIds, options);
    expect(issues).toEqual([]);
  });

  it('reports no goalkeeper issue when starters lack GK', () => {
    const noGKStarters = [
      { playerId: 'df1', position: 'CB' },
      { playerId: 'mf1', position: 'CM' },
      { playerId: 'fw1', position: 'FW' },
    ];
    const issues = checkPlannedRotationCoverage(noGKStarters, [], squadPlayerIds, options);
    expect(issues.some((i) => i.type === 'no_goalkeeper')).toBe(true);
  });

  it('reports untimed changes', () => {
    const changes = [
      { outPlayerId: 'mf1', inPlayerId: 'mf2', outPosition: 'CM', inPosition: 'CM', positionOnly: false, approximateMatchSeconds: null as number | null },
    ];
    const issues = checkPlannedRotationCoverage(starters, changes, squadPlayerIds, options);
    expect(issues.some((i) => i.type === 'untimed_change')).toBe(true);
  });

  it('reports below minimum when starting lineup is too small', () => {
    const smallStarters = [
      { playerId: 'gk1', position: 'GK' },
      { playerId: 'df1', position: 'CB' },
    ];
    const smallOptions = { ...options, minimumOnPitch: 4 };
    const issues = checkPlannedRotationCoverage(smallStarters, [], squadPlayerIds, smallOptions);
    expect(issues.some((i) => i.type === 'below_minimum')).toBe(true);
  });
});