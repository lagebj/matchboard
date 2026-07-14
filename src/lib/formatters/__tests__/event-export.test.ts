import { describe, it, expect } from 'vitest';
import {
  formatEventType,
  formatEventSquadIntent,
  formatEventPlayerStatus,
  formatEventMatchStatus,
  formatGoalkeeperAbility,
  formatPlayerName,
} from '../event-labels';
import { formatGameFormat } from '../game-format';
import { MATCH_CATEGORY_LABELS } from '@/lib/stats/match-category';
import { safeEventExportFilename } from '../event-export-filename';

describe('Event label formatters', () => {
  describe('formatEventType', () => {
    it('formats known event types', () => {
      expect(formatEventType('CUP')).toBe('Cup');
      expect(formatEventType('TOURNAMENT')).toBe('Tournament');
      expect(formatEventType('FRIENDLY_DAY')).toBe('Friendly day');
      expect(formatEventType('OTHER')).toBe('Other');
    });

    it('passes through unknown types', () => {
      expect(formatEventType('UNKNOWN')).toBe('UNKNOWN');
    });
  });

  describe('formatEventSquadIntent', () => {
    it('formats known intents', () => {
      expect(formatEventSquadIntent('COMPETITIVE')).toBe('Competitive');
      expect(formatEventSquadIntent('BALANCED')).toBe('Balanced');
      expect(formatEventSquadIntent('MANUAL')).toBe('Manual');
    });
  });

  describe('formatEventPlayerStatus', () => {
    it('formats known statuses', () => {
      expect(formatEventPlayerStatus('AVAILABLE')).toBe('Available');
      expect(formatEventPlayerStatus('UNAVAILABLE')).toBe('Unavailable');
      expect(formatEventPlayerStatus('UNKNOWN')).toBe('Unknown');
      expect(formatEventPlayerStatus('RESERVE')).toBe('Reserve');
      expect(formatEventPlayerStatus('LATE_ADDITION')).toBe('Late addition');
      expect(formatEventPlayerStatus('WITHDRAWN')).toBe('Withdrawn');
    });
  });

  describe('formatEventMatchStatus', () => {
    it('formats known statuses', () => {
      expect(formatEventMatchStatus('SCHEDULED')).toBe('Scheduled');
      expect(formatEventMatchStatus('CANCELLED')).toBe('Cancelled');
    });
  });

  describe('formatGoalkeeperAbility', () => {
    it('formats known values', () => {
      expect(formatGoalkeeperAbility('YES')).toBe('Yes');
      expect(formatGoalkeeperAbility('NO')).toBe('No');
      expect(formatGoalkeeperAbility('EMERGENCY')).toBe('Emergency');
    });

  it('returns Not rated for null', () => {
    expect(formatGoalkeeperAbility(null as unknown as string)).toBe('Not rated');
    expect(formatGoalkeeperAbility(undefined as unknown as string)).toBe('Not rated');
  });
  });

  describe('formatPlayerName', () => {
    it('combines first and last name', () => {
      expect(formatPlayerName('Ola', 'Nordmann')).toBe('Ola Nordmann');
    });

    it('returns first name only when last name is null', () => {
      expect(formatPlayerName('Ola', null)).toBe('Ola');
    });
  });

  describe('formatGameFormat', () => {
    it('formats known game formats', () => {
      expect(formatGameFormat('SEVEN_A_SIDE')).toBe('7-a-side');
      expect(formatGameFormat('FIVE_A_SIDE')).toBe('5-a-side');
      expect(formatGameFormat('ELEVEN_A_SIDE')).toBe('11-a-side');
    });
  });

  describe('MATCH_CATEGORY_LABELS', () => {
    it('maps all categories', () => {
      expect(MATCH_CATEGORY_LABELS['CUP']).toBe('Cup');
      expect(MATCH_CATEGORY_LABELS['OTHER']).toBe('Other');
      expect(MATCH_CATEGORY_LABELS['LEAGUE']).toBe('League');
    });
  });
});

describe('safeEventExportFilename', () => {
  it('creates safe filename from name and date', () => {
    const date = new Date('2026-06-12T00:00:00Z');
    expect(safeEventExportFilename('Slemmestad Cup', date)).toBe('slemmestad-cup-2026-06-12.xlsx');
  });

  it('lowercases and kebab-cases', () => {
    expect(safeEventExportFilename('My Big Tournament', new Date('2026-07-01'))).toBe(
      'my-big-tournament-2026-07-01.xlsx',
    );
  });

  it('replaces nordic characters', () => {
    expect(safeEventExportFilename('Ølgås Cup', new Date('2026-08-15'))).toBe(
      'olgas-cup-2026-08-15.xlsx',
    );
  });

  it('handles null date', () => {
    expect(safeEventExportFilename('Test Event', null)).toBe('test-event.xlsx');
  });

  it('handles undefined date', () => {
    expect(safeEventExportFilename('Test Event', undefined)).toBe('test-event.xlsx');
  });

  it('handles empty name with fallback', () => {
    expect(safeEventExportFilename('', new Date('2026-06-12'))).toBe('event-2026-06-12.xlsx');
  });

  it('removes special characters', () => {
    expect(safeEventExportFilename('Cup #3 (2026)', new Date('2026-06-12'))).toBe(
      'cup-3-2026-2026-06-12.xlsx',
    );
  });
});