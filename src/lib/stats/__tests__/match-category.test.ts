import { describe, it, expect } from 'vitest';
import { getDefaultEventMatchCategory } from '../match-category';

describe('match-category', () => {
  describe('getDefaultEventMatchCategory', () => {
    it('returns CUP for CUP event type', () => {
      expect(getDefaultEventMatchCategory('CUP')).toBe('CUP');
    });

    it('returns CUP for TOURNAMENT event type', () => {
      expect(getDefaultEventMatchCategory('TOURNAMENT')).toBe('CUP');
    });

    it('returns OTHER for FRIENDLY_DAY event type', () => {
      expect(getDefaultEventMatchCategory('FRIENDLY_DAY')).toBe('OTHER');
    });

    it('returns OTHER for OTHER event type', () => {
      expect(getDefaultEventMatchCategory('OTHER')).toBe('OTHER');
    });
  });
});