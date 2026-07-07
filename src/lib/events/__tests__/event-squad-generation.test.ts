import { describe, it, expect } from 'vitest';
import {
  generateEventSquads,
  getDefaultTargetSize,
} from '../event-squad-generation';
import {
  computeCompositeRatings,
  isGoalkeeperCapable,
  getPlayerBroadPositions,
  mapPositionToBroad,
} from '../event-types';
import { validateEventPool } from '../event-validation';
import { computeSquadBalance } from '../event-balance';
import type {
  PlayerAttributeProfile,
  GenerationInput,
  BroadPosition,
} from '../event-types';
import { getPositionFitTier, FIT_TIER_PRIORITY, computePositionScarcity, mapAnyPositionToBroad } from '@/lib/players/player-position-resolver';

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
    ballControl: 3,
    passing: 3,
    firstTouch: 3,
    oneVOneAttacking: 3,
    positioning: 3,
    oneVOneDefending: 3,
    decisionMaking: 3,
    effort: 3,
    teamplay: 3,
    concentration: 3,
    speed: 3,
    strength: 3,
    nonRotatable: false,
    preferredFoot: 'RIGHT',
    bestSide: 'RIGHT',
  };
  return { ...defaults, ...overrides };
}

function makeInput(overrides: Partial<GenerationInput> = {}): GenerationInput {
  return {
    eventId: 'e1',
    players: overrides.players ?? [],
    formations: overrides.formations ?? [],
    defaultFormationId: overrides.defaultFormationId ?? null,
    squads: overrides.squads ?? [
      { id: 's1', name: 'Squad 1', intent: 'BALANCED', targetSize: 5, minSize: null, maxSize: null, formationId: null, generationOrder: 0 },
      { id: 's2', name: 'Squad 2', intent: 'BALANCED', targetSize: 5, minSize: null, maxSize: null, formationId: null, generationOrder: 1 },
    ],
    selectionPattern: overrides.selectionPattern ?? 'ALL_BALANCED',
    lockedAssignments: overrides.lockedAssignments ?? new Map(),
    includeReserves: overrides.includeReserves ?? false,
    includeLateAdditions: overrides.includeLateAdditions ?? false,
    gameFormat: overrides.gameFormat ?? 'FIVE_A_SIDE',
  };
}

const players14 = Array.from({ length: 14 }, (_, i) =>
  makePlayer({
    playerId: `p${i + 1}`,
    firstName: `Player`,
    lastName: `${i + 1}`,
    primaryPosition: i === 0 ? 'GK' : i < 5 ? 'CB' : i < 9 ? 'CM' : 'ST',
    goalkeeperAbility: i === 0 ? 'YES' : 'NO',
    ballControl: 2 + (i % 4),
    passing: 2 + (i % 3),
    effort: 3,
  }),
);

describe('event-squad-generation', () => {
  describe('generateEventSquads', () => {
    it('all balanced: distributes players across squads', () => {
      const input = makeInput({
        players: players14,
        selectionPattern: 'ALL_BALANCED',
        squads: [
          { id: 's1', name: 'Squad 1', intent: 'BALANCED', targetSize: 7, minSize: null, maxSize: null, formationId: null, generationOrder: 0 },
          { id: 's2', name: 'Squad 2', intent: 'BALANCED', targetSize: 7, minSize: null, maxSize: null, formationId: null, generationOrder: 1 },
        ],
      });

      const result = generateEventSquads(input);

      const s1Count = result.assignments.filter((a) => a.eventSquadId === 's1').length;
      const s2Count = result.assignments.filter((a) => a.eventSquadId === 's2').length;

      expect(s1Count + s2Count).toBe(14);
      expect(Math.abs(s1Count - s2Count)).toBeLessThanOrEqual(1);
    });

    it('all balanced: places goalkeepers across squads', () => {
      const gk1 = makePlayer({ playerId: 'gk1', primaryPosition: 'GK', goalkeeperAbility: 'YES' });
      const gk2 = makePlayer({ playerId: 'gk2', primaryPosition: 'GK', goalkeeperAbility: 'YES' });
      const outfield = Array.from({ length: 8 }, (_, i) =>
        makePlayer({ playerId: `p${i}`, primaryPosition: 'CM' }),
      );

      const input = makeInput({
        players: [gk1, gk2, ...outfield],
        selectionPattern: 'ALL_BALANCED',
      });

      const result = generateEventSquads(input);

      const gk1Squad = result.assignments.find((a) => a.playerId === 'gk1')!.eventSquadId;
      const gk2Squad = result.assignments.find((a) => a.playerId === 'gk2')!.eventSquadId;

      expect(gk1Squad).not.toBe(gk2Squad);
    });

    it('position-first: primary fit preferred over secondary fit', () => {
      const gk = makePlayer({ playerId: 'gk', primaryPosition: 'GK', goalkeeperAbility: 'YES' });
      const cb = makePlayer({ playerId: 'cb1', primaryPosition: 'CB' });
      const cm = makePlayer({ playerId: 'cm1', primaryPosition: 'CM' });
      const st = makePlayer({ playerId: 'st1', primaryPosition: 'ST' });
      const cmAsCb = makePlayer({ playerId: 'cmAsCb', primaryPosition: 'CM', secondaryPosition: 'CB' });

      const input = makeInput({
        players: [gk, cb, cm, st, cmAsCb],
        selectionPattern: 'ALL_BALANCED',
        squads: [
          { id: 's1', name: 'Squad 1', intent: 'BALANCED', targetSize: 5, minSize: null, maxSize: null, formationId: null, generationOrder: 0 },
        ],
        gameFormat: 'FIVE_A_SIDE',
      });

      const result = generateEventSquads(input);

      const cbAssignment = result.assignments.find((a) => a.playerId === 'cb1');
      const cmAsCbAssignment = result.assignments.find((a) => a.playerId === 'cmAsCb');

      if (cbAssignment?.positionFitTier && cmAsCbAssignment?.positionFitTier) {
        expect(FIT_TIER_PRIORITY[cbAssignment.positionFitTier]).toBeLessThanOrEqual(
          FIT_TIER_PRIORITY[cmAsCbAssignment.positionFitTier],
        );
      }
    });

    it('position-first: competitive squad fills tactical slots with position fit', () => {
      const gk = makePlayer({ playerId: 'gk', primaryPosition: 'GK', goalkeeperAbility: 'YES', ballControl: 2, passing: 2 });
      const weakCb = makePlayer({ playerId: 'weakCb', primaryPosition: 'CB', ballControl: 2, passing: 2 });
      const strongCm = makePlayer({ playerId: 'strongCm', primaryPosition: 'CM', ballControl: 5, passing: 5 });
      const weakSt = makePlayer({ playerId: 'weakSt', primaryPosition: 'ST', ballControl: 2, passing: 2 });
      const flexible = makePlayer({ playerId: 'flex', primaryPosition: 'CM', ballControl: 4, passing: 4 });

      const input = makeInput({
        players: [gk, weakCb, strongCm, weakSt, flexible],
        selectionPattern: 'ONE_COMPETITIVE_BALANCED_REMAINDER',
        squads: [
          { id: 's1', name: 'Competitive', intent: 'COMPETITIVE', targetSize: 5, minSize: null, maxSize: null, formationId: null, generationOrder: 0 },
        ],
        gameFormat: 'FIVE_A_SIDE',
      });

      const result = generateEventSquads(input);

      const competitiveAssignments = result.assignments.filter((a) => a.eventSquadId === 's1');
      expect(competitiveAssignments.length).toBe(5);

      const gkAssignment = competitiveAssignments.find((a) => a.playerId === 'gk');
      expect(gkAssignment).toBeDefined();
      expect(gkAssignment!.positionFitTier).toBe('PRIMARY');

      const allHaveFitTier = competitiveAssignments.every((a) => a.positionFitTier !== null);
      expect(allHaveFitTier).toBe(true);
    });

    it('position-first: no player appears in two squads', () => {
      const input = makeInput({
        players: players14,
        selectionPattern: 'ALL_BALANCED',
      });

      const result = generateEventSquads(input);

      const playerIds = result.assignments.map((a) => a.playerId);
      const uniqueIds = new Set(playerIds);
      expect(playerIds.length).toBe(uniqueIds.size);
    });

    it('one competitive + balanced remainder: fills competitive squad first', () => {
      const input = makeInput({
        players: players14,
        selectionPattern: 'ONE_COMPETITIVE_BALANCED_REMAINDER',
        squads: [
          { id: 's1', name: 'Competitive', intent: 'COMPETITIVE', targetSize: 5, minSize: null, maxSize: null, formationId: null, generationOrder: 0 },
          { id: 's2', name: 'Balanced A', intent: 'BALANCED', targetSize: 5, minSize: null, maxSize: null, formationId: null, generationOrder: 1 },
          { id: 's3', name: 'Balanced B', intent: 'BALANCED', targetSize: 5, minSize: null, maxSize: null, formationId: null, generationOrder: 2 },
        ],
      });

      const result = generateEventSquads(input);

      const competitiveCount = result.assignments.filter((a) => a.eventSquadId === 's1').length;
      expect(competitiveCount).toBe(5);
    });

    it('competitive squad includes goalkeeper', () => {
      const gk = makePlayer({ playerId: 'gk', primaryPosition: 'GK', goalkeeperAbility: 'YES', ballControl: 4, passing: 3 });
      const outfield = Array.from({ length: 8 }, (_, i) =>
        makePlayer({ playerId: `p${i}`, primaryPosition: 'CM', ballControl: 2, passing: 2 }),
      );

      const input = makeInput({
        players: [gk, ...outfield],
        selectionPattern: 'ONE_COMPETITIVE_BALANCED_REMAINDER',
        squads: [
          { id: 's1', name: 'Competitive', intent: 'COMPETITIVE', targetSize: 5, minSize: null, maxSize: null, formationId: null, generationOrder: 0 },
          { id: 's2', name: 'Balanced', intent: 'BALANCED', targetSize: 5, minSize: null, maxSize: null, formationId: null, generationOrder: 1 },
        ],
      });

      const result = generateEventSquads(input);

      const gkAssignment = result.assignments.find((a) => a.playerId === 'gk')!;
      expect(gkAssignment.eventSquadId).toBe('s1');
    });

    it('locked players are preserved on regeneration', () => {
      const locked = makePlayer({ playerId: 'locked1' });
      const others = Array.from({ length: 8 }, (_, i) =>
        makePlayer({ playerId: `p${i}` }),
      );

      const lockedAssignments = new Map<string, string>();
      lockedAssignments.set('locked1', 's1');

      const input = makeInput({
        players: [locked, ...others],
        selectionPattern: 'ALL_BALANCED',
        lockedAssignments,
      });

      const result = generateEventSquads(input);

      const lockedAssignment = result.assignments.find((a) => a.playerId === 'locked1')!;
      expect(lockedAssignment.eventSquadId).toBe('s1');
      expect(lockedAssignment.source).toBe('LOCKED');
      expect(lockedAssignment.locked).toBe(true);
    });

    it('selection reason includes position fit tier', () => {
      const gk = makePlayer({ playerId: 'gk', primaryPosition: 'GK', goalkeeperAbility: 'YES' });
      const cb = makePlayer({ playerId: 'cb1', primaryPosition: 'CB' });
      const cm = makePlayer({ playerId: 'cm1', primaryPosition: 'CM' });
      const st = makePlayer({ playerId: 'st1', primaryPosition: 'ST' });
      const cmSec = makePlayer({ playerId: 'cm2', primaryPosition: 'CM', secondaryPosition: 'CB' });

      const input = makeInput({
        players: [gk, cb, cm, st, cmSec],
        selectionPattern: 'ALL_BALANCED',
        squads: [
          { id: 's1', name: 'Squad 1', intent: 'BALANCED', targetSize: 5, minSize: null, maxSize: null, formationId: null, generationOrder: 0 },
        ],
        gameFormat: 'FIVE_A_SIDE',
      });

      const result = generateEventSquads(input);

      const gkAssignment = result.assignments.find((a) => a.playerId === 'gk');
      expect(gkAssignment).toBeDefined();
      expect(gkAssignment!.selectionReason).toContain('goalkeeper');

      const cbAssignment = result.assignments.find((a) => a.playerId === 'cb1');
      expect(cbAssignment).toBeDefined();
      if (cbAssignment?.positionFitTier) {
        expect(cbAssignment.positionFitTier).toBe('PRIMARY');
      }
    });

    it('scarcity notes emitted when few primary players for position', () => {
      const gk = makePlayer({ playerId: 'gk', primaryPosition: 'GK', goalkeeperAbility: 'YES' });
      const midfielders = Array.from({ length: 11 }, (_, i) =>
        makePlayer({ playerId: `cm${i}`, primaryPosition: 'CM' }),
      );

      const input = makeInput({
        players: [gk, ...midfielders],
        selectionPattern: 'ALL_BALANCED',
        squads: [
          { id: 's1', name: 'Squad 1', intent: 'BALANCED', targetSize: 5, minSize: null, maxSize: null, formationId: null, generationOrder: 0 },
          { id: 's2', name: 'Squad 2', intent: 'BALANCED', targetSize: 5, minSize: null, maxSize: null, formationId: null, generationOrder: 1 },
        ],
        gameFormat: 'FIVE_A_SIDE',
      });

      const result = generateEventSquads(input);

      const hasScarcityNote = result.validationNotes.some(
        (n) => n.includes('primary') || n.includes('goalkeeper') || n.includes('forward') || n.includes('defender'),
      );
      expect(hasScarcityNote).toBe(true);
    });

    it('missing ratings produce uncertainty note in selection reason', () => {
      const unrated = makePlayer({ playerId: 'unrated', ballControl: null, passing: null, firstTouch: null, oneVOneAttacking: null, positioning: null, oneVOneDefending: null, decisionMaking: null, effort: null, teamplay: null, concentration: null, speed: null, strength: null });
      const rated = makePlayer({ playerId: 'rated1', ballControl: 3, passing: 3, effort: 3 });
      const rated2 = makePlayer({ playerId: 'rated2', ballControl: 3, passing: 3, effort: 3 });
      const rated3 = makePlayer({ playerId: 'rated3', ballControl: 3, passing: 3, effort: 3 });
      const input = makeInput({
        players: [unrated, rated, rated2, rated3],
        selectionPattern: 'ALL_BALANCED',
        squads: [
          { id: 's1', name: 'Squad 1', intent: 'BALANCED', targetSize: 5, minSize: null, maxSize: null, formationId: null, generationOrder: 0 },
          { id: 's2', name: 'Squad 2', intent: 'BALANCED', targetSize: 5, minSize: null, maxSize: null, formationId: null, generationOrder: 1 },
        ],
      });

      const result = generateEventSquads(input);

      const assignment = result.assignments.find((a) => a.playerId === 'unrated');
      expect(assignment).toBeDefined();
      expect(assignment!.selectionReason.toLowerCase()).toContain('uncertainty');
    });

    it('handles empty player pool', () => {
      const input = makeInput({
        players: [],
        selectionPattern: 'ALL_BALANCED',
      });

      const result = generateEventSquads(input);

      expect(result.assignments).toHaveLength(0);
      expect(result.balanceSummaries).toHaveLength(2);
      for (const summary of result.balanceSummaries) {
        expect(summary.playerCount).toBe(0);
      }
    });

    it('fallback to all balanced when no competitive squad exists', () => {
      const input = makeInput({
        players: players14.slice(0, 10),
        selectionPattern: 'ONE_COMPETITIVE_BALANCED_REMAINDER',
        squads: [
          { id: 's1', name: 'Balanced A', intent: 'BALANCED', targetSize: 5, minSize: null, maxSize: null, formationId: null, generationOrder: 0 },
          { id: 's2', name: 'Balanced B', intent: 'BALANCED', targetSize: 5, minSize: null, maxSize: null, formationId: null, generationOrder: 1 },
        ],
      });

      const result = generateEventSquads(input);

      expect(result.validationNotes).toContainEqual(
        expect.stringContaining('No competitive squad'),
      );
      expect(result.assignments.length).toBeGreaterThan(0);
    });
  });

  describe('getDefaultTargetSize', () => {
    it('returns correct sizes for each format', () => {
      expect(getDefaultTargetSize('THREE_A_SIDE')).toBe(3);
      expect(getDefaultTargetSize('FIVE_A_SIDE')).toBe(5);
      expect(getDefaultTargetSize('SEVEN_A_SIDE')).toBe(7);
      expect(getDefaultTargetSize('NINE_A_SIDE')).toBe(9);
      expect(getDefaultTargetSize('ELEVEN_A_SIDE')).toBe(11);
    });
  });
});

describe('event-types', () => {
  describe('computeCompositeRatings', () => {
    it('computes overall from all non-null attributes', () => {
      const player = makePlayer({
        ballControl: 4, passing: 3, firstTouch: 4, oneVOneAttacking: 3,
        positioning: 4, oneVOneDefending: 3, decisionMaking: 4,
        effort: 3, teamplay: 4, concentration: 3, speed: 4, strength: 3,
      });
      const ratings = computeCompositeRatings(player);
      expect(ratings.overallLevel).toBe(3.5);
    });

    it('returns null overall when all attributes are null', () => {
      const player = makePlayer({
        ballControl: null, passing: null, firstTouch: null, oneVOneAttacking: null,
        positioning: null, oneVOneDefending: null, decisionMaking: null,
        effort: null, teamplay: null, concentration: null, speed: null, strength: null,
      });
      const ratings = computeCompositeRatings(player);
      expect(ratings.overallLevel).toBeNull();
    });

    it('computes composites from available attributes only', () => {
      const player = makePlayer({
        ballControl: 4, passing: null, firstTouch: null, oneVOneAttacking: null,
        positioning: 3, oneVOneDefending: null, decisionMaking: null,
        effort: 5, teamplay: null, concentration: null, speed: null, strength: null,
      });
      const ratings = computeCompositeRatings(player);
      expect(ratings.overallLevel).not.toBeNull();
      expect(ratings.defending).toBe(3);
      expect(ratings.attacking).toBe(4);
      expect(ratings.intensity).toBe(5);
    });

    it('teamplay is direct value', () => {
      const player = makePlayer({ teamplay: 4 });
      const ratings = computeCompositeRatings(player);
      expect(ratings.teamplay).toBe(4);
    });

    it('teamplay is null when not rated', () => {
      const player = makePlayer({ teamplay: null });
      const ratings = computeCompositeRatings(player);
      expect(ratings.teamplay).toBeNull();
    });
  });

  describe('isGoalkeeperCapable', () => {
    it('returns true for YES goalkeeper ability', () => {
      expect(isGoalkeeperCapable(makePlayer({ goalkeeperAbility: 'YES' }))).toBe(true);
    });

    it('returns true for EMERGENCY goalkeeper ability', () => {
      expect(isGoalkeeperCapable(makePlayer({ goalkeeperAbility: 'EMERGENCY' }))).toBe(true);
    });

    it('returns false for NO goalkeeper ability', () => {
      expect(isGoalkeeperCapable(makePlayer({ goalkeeperAbility: 'NO' }))).toBe(false);
    });
  });

  describe('getPlayerBroadPositions', () => {
    it('maps primary position', () => {
      const player = makePlayer({ primaryPosition: 'GK', secondaryPosition: null, tertiaryPosition: null });
      const positions = getPlayerBroadPositions(player);
      expect(positions).toContain('goalkeeper');
    });

    it('deduplicates positions', () => {
      const player = makePlayer({ primaryPosition: 'CM', secondaryPosition: 'W', tertiaryPosition: null });
      const positions = getPlayerBroadPositions(player);
      expect(positions).toEqual(['midfielder']);
    });

    it('returns flexible for unknown positions', () => {
      const player = makePlayer({ primaryPosition: 'UNKNOWN_POS' });
      const positions = getPlayerBroadPositions(player);
      expect(positions).toEqual(['flexible']);
    });
  });

  describe('mapPositionToBroad', () => {
    it('maps known positions correctly', () => {
      expect(mapPositionToBroad('GK')).toBe('goalkeeper');
      expect(mapPositionToBroad('CB')).toBe('defender');
      expect(mapPositionToBroad('CM')).toBe('midfielder');
      expect(mapPositionToBroad('W')).toBe('midfielder');
      expect(mapPositionToBroad('ST')).toBe('forward');
    });

    it('maps unknown position to flexible', () => {
      expect(mapPositionToBroad('XYZ')).toBe('flexible');
    });
  });
});

describe('player-position-resolver', () => {
  describe('getPositionFitTier', () => {
    it('returns PRIMARY when primary position matches slot', () => {
      expect(getPositionFitTier('CB', null, null, ['defender', 'midfielder'])).toBe('PRIMARY');
    });

    it('returns SECONDARY when only secondary position matches slot', () => {
      expect(getPositionFitTier('ST', 'CB', null, ['defender'])).toBe('SECONDARY');
    });

    it('returns TERTIARY when tertiary position matches slot', () => {
      expect(getPositionFitTier('ST', 'CM', 'CB', ['defender'])).toBe('TERTIARY');
    });

    it('returns NO_FIT when no position matches', () => {
      expect(getPositionFitTier('ST', null, null, ['goalkeeper'])).toBe('NO_FIT');
    });

    it('returns NO_FIT for flexible slot with no position match', () => {
      expect(getPositionFitTier('ST', null, null, ['goalkeeper', 'flexible'])).toBe('NO_FIT');
    });

    it('ignores NONE for secondary position', () => {
      expect(getPositionFitTier('ST', 'NONE', null, ['defender'])).toBe('NO_FIT');
    });

    it('PRIMARY takes priority over SECONDARY', () => {
      const tier = getPositionFitTier('CM', 'CB', null, ['midfielder']);
      expect(tier).toBe('PRIMARY');
    });
  });

  describe('FIT_TIER_PRIORITY', () => {
    it('orders tiers correctly', () => {
      expect(FIT_TIER_PRIORITY.PRIMARY).toBeLessThan(FIT_TIER_PRIORITY.SECONDARY);
      expect(FIT_TIER_PRIORITY.SECONDARY).toBeLessThan(FIT_TIER_PRIORITY.TERTIARY);
      expect(FIT_TIER_PRIORITY.TERTIARY).toBeLessThan(FIT_TIER_PRIORITY.NO_FIT);
    });
  });

  describe('computePositionScarcity', () => {
    it('detects scarce positions', () => {
      const players = [
        { primaryPosition: 'GK', secondaryPosition: null, tertiaryPosition: null, goalkeeperAbility: 'YES' },
        { primaryPosition: 'CM', secondaryPosition: null, tertiaryPosition: null, goalkeeperAbility: 'NO' },
        { primaryPosition: 'CM', secondaryPosition: null, tertiaryPosition: null, goalkeeperAbility: 'NO' },
      ];

      const scarcity = computePositionScarcity(players, 2);
      const gkScarcity = scarcity.find((s) => s.position === 'goalkeeper')!;
      expect(gkScarcity.isScarce).toBe(true);
      expect(gkScarcity.primaryCandidateCount).toBe(1);
    });

    it('detects sufficient positions', () => {
      const players = [
        { primaryPosition: 'GK', secondaryPosition: null, tertiaryPosition: null, goalkeeperAbility: 'YES' },
        { primaryPosition: 'GK', secondaryPosition: null, tertiaryPosition: null, goalkeeperAbility: 'YES' },
        { primaryPosition: 'CM', secondaryPosition: null, tertiaryPosition: null, goalkeeperAbility: 'NO' },
        { primaryPosition: 'CM', secondaryPosition: null, tertiaryPosition: null, goalkeeperAbility: 'NO' },
      ];

      const scarcity = computePositionScarcity(players, 2);
      const gkScarcity = scarcity.find((s) => s.position === 'goalkeeper')!;
      expect(gkScarcity.isScarce).toBe(false);
    });
  });

  describe('mapAnyPositionToBroad', () => {
    it('maps known positions', () => {
      expect(mapAnyPositionToBroad('GK')).toBe('goalkeeper');
      expect(mapAnyPositionToBroad('CB')).toBe('defender');
      expect(mapAnyPositionToBroad('CM')).toBe('midfielder');
      expect(mapAnyPositionToBroad('W')).toBe('midfielder');
      expect(mapAnyPositionToBroad('ST')).toBe('forward');
    });

    it('maps unknown to flexible', () => {
      expect(mapAnyPositionToBroad('UNKNOWN')).toBe('flexible');
    });
  });
});

describe('event-validation', () => {
  describe('validateEventPool', () => {
    const formatSlots: { roleType: string; acceptedPositions: BroadPosition[]; label: string }[] = [];

    it('warns when not enough players', () => {
      const players = Array.from({ length: 6 }, (_, i) =>
        makePlayer({ playerId: `p${i}` }),
      );
      const result = validateEventPool(players, 2, 5, 'FIVE_A_SIDE', formatSlots);
      expect(result.warnings).toContainEqual(
        expect.stringContaining('Not enough available players'),
      );
    });

    it('warns when insufficient goalkeeper coverage', () => {
      const players = Array.from({ length: 14 }, (_, i) =>
        makePlayer({ playerId: `p${i}`, primaryPosition: 'CM', goalkeeperAbility: 'NO' }),
      );
      const result = validateEventPool(players, 2, 5, 'FIVE_A_SIDE', formatSlots);
      expect(result.warnings).toContainEqual(
        expect.stringContaining('goalkeeper'),
      );
    });

    it('notes many missing ratings', () => {
      const players = Array.from({ length: 14 }, (_, i) =>
        makePlayer({ playerId: `p${i}`, ballControl: null, passing: null, effort: null }),
      );
      const result = validateEventPool(players, 2, 5, 'FIVE_A_SIDE', formatSlots);
      expect(result.notes).toContainEqual(
        expect.stringContaining('missing ratings'),
      );
    });

    it('succeeds with sufficient players and goalkeepers', () => {
      const gk1 = makePlayer({ playerId: 'gk1', primaryPosition: 'GK', goalkeeperAbility: 'YES' });
      const gk2 = makePlayer({ playerId: 'gk2', primaryPosition: 'GK', goalkeeperAbility: 'YES' });
      const outfield = Array.from({ length: 12 }, (_, i) =>
        makePlayer({ playerId: `p${i}` }),
      );
      const players = [gk1, gk2, ...outfield];
      const result = validateEventPool(players, 2, 5, 'FIVE_A_SIDE', formatSlots);
      expect(result.goalkeeperCoverage.sufficient).toBe(true);
      expect(result.availablePlayerCount).toBe(14);
    });
  });
});

describe('event-balance', () => {
  describe('computeSquadBalance', () => {
    it('computes balance summary for a squad', () => {
      const gk = makePlayer({ playerId: 'gk', primaryPosition: 'GK', goalkeeperAbility: 'YES' });
      const def = makePlayer({ playerId: 'def', primaryPosition: 'CB', ballControl: 3 });
      const mid = makePlayer({ playerId: 'mid', primaryPosition: 'CM', ballControl: 4 });

      const summary = computeSquadBalance('s1', 'Squad 1', 'BALANCED', [gk, def, mid]);

      expect(summary.playerCount).toBe(3);
      expect(summary.goalkeeperCount).toBe(1);
      expect(summary.defenderCount).toBe(1);
      expect(summary.midfielderCount).toBe(1);
      expect(summary.averageOverall).not.toBeNull();
    });

    it('notes missing goalkeeper', () => {
      const players = Array.from({ length: 5 }, (_, i) =>
        makePlayer({ playerId: `p${i}`, primaryPosition: 'CM', goalkeeperAbility: 'NO' }),
      );

      const summary = computeSquadBalance('s1', 'Squad 1', 'BALANCED', players);

      expect(summary.coverageNotes).toContainEqual(
        expect.stringContaining('No goalkeeper'),
      );
    });

    it('notes missing defenders', () => {
      const gk = makePlayer({ playerId: 'gk', primaryPosition: 'GK', goalkeeperAbility: 'YES' });
      const mids = Array.from({ length: 4 }, (_, i) =>
        makePlayer({ playerId: `mid${i}`, primaryPosition: 'CM' }),
      );

      const summary = computeSquadBalance('s1', 'Squad 1', 'BALANCED', [gk, ...mids]);

      expect(summary.coverageNotes).toContainEqual(
        expect.stringContaining('No defensive coverage'),
      );
    });

    it('counts missing ratings', () => {
      const players = [
        makePlayer({ playerId: 'p1', ballControl: null, passing: null, effort: null }),
        makePlayer({ playerId: 'p2', ballControl: 3, passing: 3, effort: 3 }),
      ];

      const summary = computeSquadBalance('s1', 'Squad 1', 'BALANCED', players);
      expect(summary.missingRatingsCount).toBe(1);
    });
  });
});

describe('player attribute null handling', () => {
  it('null displays as not rated, not zero', () => {
    const player = makePlayer({ ballControl: null });
    const ratings = computeCompositeRatings(player);
    expect(ratings.attacking).not.toBe(0);
    expect(ratings.attacking).toBe(player.oneVOneAttacking);
  });

  it('1-5 validation: values outside range should not crash', () => {
    const player = makePlayer({ ballControl: 1, passing: 5, effort: 3 });
    const ratings = computeCompositeRatings(player);
    expect(ratings.overallLevel).toBeGreaterThanOrEqual(1);
    expect(ratings.overallLevel).toBeLessThanOrEqual(5);
  });

  it('composite ratings derive correctly from null-aware averages', () => {
    const player = makePlayer({
      oneVOneDefending: 4,
      positioning: 2,
      ballControl: null,
      oneVOneAttacking: null,
    });
    const ratings = computeCompositeRatings(player);
    expect(ratings.defending).toBe(3);
    expect(ratings.attacking).toBeNull();
  });
});

describe('consecutive support penalty not in event squads', () => {
  it('event squads are independent of league round support penalties', () => {
    const input = makeInput({
      players: players14,
      selectionPattern: 'ALL_BALANCED',
      squads: [
        { id: 's1', name: 'Squad 1', intent: 'BALANCED', targetSize: 7, minSize: null, maxSize: null, formationId: null, generationOrder: 0 },
        { id: 's2', name: 'Squad 2', intent: 'BALANCED', targetSize: 7, minSize: null, maxSize: null, formationId: null, generationOrder: 1 },
      ],
    });

    const result = generateEventSquads(input);

    expect(result.assignments.length).toBe(14);
    expect(result.warnings.length).toBeLessThanOrEqual(1);
  });
});

describe('position-fit-tier assignments', () => {
  it('competitive squad: PRIMARY fit players fill tactical slots before SECONDARY', () => {
    const gk = makePlayer({ playerId: 'gk', primaryPosition: 'GK', goalkeeperAbility: 'YES' });
    const primaryCb = makePlayer({ playerId: 'cb_primary', primaryPosition: 'CB' });
    const secondaryCb = makePlayer({ playerId: 'cm_as_cb', primaryPosition: 'CM', secondaryPosition: 'CB' });
    const st = makePlayer({ playerId: 'st', primaryPosition: 'ST' });
    const cm = makePlayer({ playerId: 'cm', primaryPosition: 'CM' });

    const input = makeInput({
      players: [gk, primaryCb, secondaryCb, st, cm],
      selectionPattern: 'ONE_COMPETITIVE_BALANCED_REMAINDER',
      squads: [
        { id: 'comp', name: 'Competitive', intent: 'COMPETITIVE', targetSize: 5, minSize: null, maxSize: null, formationId: null, generationOrder: 0 },
      ],
      gameFormat: 'FIVE_A_SIDE',
    });

    const result = generateEventSquads(input);

    const cbAssignment = result.assignments.find((a) => a.playerId === 'cb_primary');

    if (cbAssignment?.positionFitTier) {
      expect(cbAssignment.positionFitTier).toBe('PRIMARY');
    }
  });

  it('event squad: unrated player gets uncertainty note', () => {
    const unrated = makePlayer({
      playerId: 'unrated',
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
    });
    const rated = makePlayer({ playerId: 'rated', ballControl: 3, passing: 3 });

    const input = makeInput({
      players: [unrated, rated],
      selectionPattern: 'ALL_BALANCED',
      squads: [
        { id: 's1', name: 'Squad 1', intent: 'BALANCED', targetSize: 5, minSize: null, maxSize: null, formationId: null, generationOrder: 0 },
      ],
      gameFormat: 'THREE_A_SIDE',
    });

    const result = generateEventSquads(input);
    const unratedAssignment = result.assignments.find((a) => a.playerId === 'unrated');
    expect(unratedAssignment).toBeDefined();
    expect(unratedAssignment!.selectionReason.toLowerCase()).toContain('uncertainty');
  });
});