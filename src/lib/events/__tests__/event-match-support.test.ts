import { describe, it, expect } from 'vitest';
import { getSupportCandidatesForEventMatch, checkSupportConflicts } from '../event-match-support';
import type { EventSquadMatchTiming } from '../event-types';

function timingMap(
  squadIds: string[],
  overrides: Partial<EventSquadMatchTiming> = {},
): Map<string, EventSquadMatchTiming> {
  const timing: EventSquadMatchTiming = {
    numberOfHalves: 1,
    matchDurationMinutes: 20,
    breakDurationMinutes: null,
    ...overrides,
  };
  return new Map(squadIds.map((id) => [id, timing]));
}

describe('getSupportCandidatesForEventMatch', () => {
  const baseTargetMatch = {
    id: 'match2',
    eventSquadId: 'squadB',
    startsAt: new Date('2026-07-01T11:30:00'),
    status: 'SCHEDULED' as const,
  };

  const baseAllMatches = [
    {
      id: 'match1',
      eventSquadId: 'squadA',
      startsAt: new Date('2026-07-01T11:00:00'),
      status: 'SCHEDULED' as const,
    },
    {
      id: 'match2',
      eventSquadId: 'squadB',
      startsAt: new Date('2026-07-01T11:30:00'),
      status: 'SCHEDULED' as const,
    },
  ];

  const baseSquads = [
    { id: 'squadA', name: 'Squad A', players: [{ playerId: 'p1' }] },
    { id: 'squadB', name: 'Squad B', players: [{ playerId: 'p2' }] },
  ];

  const baseTiming = timingMap(['squadA', 'squadB']);

  const baseProfiles = [
    {
      id: 'p1',
      firstName: 'Alice',
      lastName: 'Smith',
      primaryPosition: null,
      secondaryPosition: null,
      tertiaryPosition: null,
      goalkeeperAbility: null as string | null,
      coreTeamId: null as string | null,
      ballControl: null as number | null,
      passing: null as number | null,
      firstTouch: null as number | null,
      oneVOneAttacking: null as number | null,
      positioning: null as number | null,
      oneVOneDefending: null as number | null,
      decisionMaking: null as number | null,
      effort: null as number | null,
      teamplay: null as number | null,
      concentration: null as number | null,
      speed: null as number | null,
      strength: null as number | null,
      nonRotatable: false,
      preferredFoot: 'RIGHT' as string,
      bestSide: 'RIGHT' as string,
    },
    {
      id: 'p2',
      firstName: 'Bob',
      lastName: 'Jones',
      primaryPosition: null,
      secondaryPosition: null,
      tertiaryPosition: null,
      goalkeeperAbility: null as string | null,
      coreTeamId: null as string | null,
      ballControl: null as number | null,
      passing: null as number | null,
      firstTouch: null as number | null,
      oneVOneAttacking: null as number | null,
      positioning: null as number | null,
      oneVOneDefending: null as number | null,
      decisionMaking: null as number | null,
      effort: null as number | null,
      teamplay: null as number | null,
      concentration: null as number | null,
      speed: null as number | null,
      strength: null as number | null,
      nonRotatable: false,
      preferredFoot: 'RIGHT' as string,
      bestSide: 'RIGHT' as string,
    },
  ];

  const baseAvailability = [
    { playerId: 'p1', status: 'AVAILABLE' },
    { playerId: 'p2', status: 'AVAILABLE' },
  ];

  it('returns all candidates from other squads when no overlap', () => {
    const candidates = getSupportCandidatesForEventMatch({
      targetMatch: baseTargetMatch,
      timingBySquadId: baseTiming,
      allEventMatches: baseAllMatches,
      eventSquads: baseSquads,
      playerProfiles: baseProfiles,
      existingSupportAssignments: [],
      playerEventAvailability: baseAvailability,
    });

    const eligible = candidates.filter((c) => c.available);
    expect(eligible.length).toBe(1);
    expect(eligible[0]!.playerId).toBe('p1');
    expect(eligible[0]!.sourceEventSquadId).toBe('squadA');
  });

  it('marks player from target squad as unavailable', () => {
    const candidates = getSupportCandidatesForEventMatch({
      targetMatch: baseTargetMatch,
      timingBySquadId: baseTiming,
      allEventMatches: baseAllMatches,
      eventSquads: baseSquads,
      playerProfiles: baseProfiles,
      existingSupportAssignments: [],
      playerEventAvailability: baseAvailability,
    });

    const fromTargetSquad = candidates.filter((c) => c.sourceEventSquadId === 'squadB');
    expect(fromTargetSquad.every((c) => !c.available)).toBe(true);
  });

  it('marks player from squad with overlapping match as unavailable', () => {
    const overlappingMatches = [
      { id: 'match1', eventSquadId: 'squadA', startsAt: new Date('2026-07-01T11:30:00'), status: 'SCHEDULED' as const },
      { id: 'match2', eventSquadId: 'squadB', startsAt: new Date('2026-07-01T11:30:00'), status: 'SCHEDULED' as const },
    ];

    const candidates = getSupportCandidatesForEventMatch({
      targetMatch: baseTargetMatch,
      timingBySquadId: baseTiming,
      allEventMatches: overlappingMatches,
      eventSquads: baseSquads,
      playerProfiles: baseProfiles,
      existingSupportAssignments: [],
      playerEventAvailability: baseAvailability,
    });

    const fromSquadA = candidates.filter((c) => c.sourceEventSquadId === 'squadA');
    expect(fromSquadA.every((c) => !c.available)).toBe(true);
    expect(fromSquadA.some((c) => c.unavailableReason === 'Own squad has overlapping match')).toBe(true);
  });

  it('allows player from squad with cancelled overlapping match', () => {
    const matchesWithCancelled = [
      { id: 'match1', eventSquadId: 'squadA', startsAt: new Date('2026-07-01T11:30:00'), status: 'CANCELLED' as const },
      baseTargetMatch,
    ];

    const candidates = getSupportCandidatesForEventMatch({
      targetMatch: baseTargetMatch,
      timingBySquadId: baseTiming,
      allEventMatches: matchesWithCancelled,
      eventSquads: baseSquads,
      playerProfiles: baseProfiles,
      existingSupportAssignments: [],
      playerEventAvailability: baseAvailability,
    });

    const eligible = candidates.filter((c) => c.available);
    expect(eligible.some((c) => c.playerId === 'p1')).toBe(true);
  });

  it('marks unavailable player as unavailable', () => {
    const candidates = getSupportCandidatesForEventMatch({
      targetMatch: baseTargetMatch,
      timingBySquadId: baseTiming,
      allEventMatches: baseAllMatches,
      eventSquads: baseSquads,
      playerProfiles: baseProfiles,
      existingSupportAssignments: [],
      playerEventAvailability: [
        { playerId: 'p1', status: 'UNAVAILABLE' },
        { playerId: 'p2', status: 'AVAILABLE' },
      ],
    });

    const p1 = candidates.find((c) => c.playerId === 'p1');
    expect(p1!.available).toBe(false);
    expect(p1!.unavailableReason).toBe('Player unavailable for event');
  });

  it('marks withdrawn player as unavailable', () => {
    const candidates = getSupportCandidatesForEventMatch({
      targetMatch: baseTargetMatch,
      timingBySquadId: baseTiming,
      allEventMatches: baseAllMatches,
      eventSquads: baseSquads,
      playerProfiles: baseProfiles,
      existingSupportAssignments: [],
      playerEventAvailability: [
        { playerId: 'p1', status: 'WITHDRAWN' },
        { playerId: 'p2', status: 'AVAILABLE' },
      ],
    });

    const p1 = candidates.find((c) => c.playerId === 'p1');
    expect(p1!.available).toBe(false);
    expect(p1!.unavailableReason).toBe('Player unavailable for event');
  });

  it('marks all candidates unavailable when duration is not set', () => {
    const candidates = getSupportCandidatesForEventMatch({
      targetMatch: baseTargetMatch,
      timingBySquadId: timingMap(['squadA', 'squadB'], { matchDurationMinutes: null }),
      allEventMatches: baseAllMatches,
      eventSquads: baseSquads,
      playerProfiles: baseProfiles,
      existingSupportAssignments: [],
      playerEventAvailability: baseAvailability,
    });

    expect(candidates.every((c) => !c.available)).toBe(true);
    expect(candidates.every((c) => c.unavailableReason === 'Event match duration not set')).toBe(true);
  });

  it('marks player already helping another overlapping match as unavailable', () => {
    const anotherMatch = {
      id: 'match3',
      eventSquadId: 'squadC',
      startsAt: new Date('2026-07-01T11:35:00'),
      status: 'SCHEDULED' as const,
    };

    const threeSquads = [
      ...baseSquads,
      { id: 'squadC', name: 'Squad C', players: [] },
    ];

    const candidates = getSupportCandidatesForEventMatch({
      targetMatch: baseTargetMatch,
      timingBySquadId: timingMap(['squadA', 'squadB', 'squadC']),
      allEventMatches: [...baseAllMatches, anotherMatch],
      eventSquads: threeSquads,
      playerProfiles: baseProfiles,
      existingSupportAssignments: [
        { eventMatchId: 'match3', playerId: 'p1', targetEventSquadId: 'squadC' },
      ],
      playerEventAvailability: baseAvailability,
    });

    const p1 = candidates.find((c) => c.playerId === 'p1');
    expect(p1!.available).toBe(false);
    expect(p1!.unavailableReason).toBe('Already helping another overlapping match');
  });

  it('sorts eligible candidates before ineligible ones', () => {
    const threeSquads = [
      { id: 'squadA', name: 'Squad A', players: [{ playerId: 'p1' }, { playerId: 'p3' }] },
      { id: 'squadB', name: 'Squad B', players: [{ playerId: 'p2' }] },
      { id: 'squadC', name: 'Squad C', players: [{ playerId: 'p4' }] },
    ];

    const threeProfiles = [
      ...baseProfiles,
      {
        id: 'p3',
        firstName: 'Charlie',
        lastName: 'Brown',
        primaryPosition: null as string | null,
        secondaryPosition: null as string | null,
        tertiaryPosition: null as string | null,
        goalkeeperAbility: null as string | null,
        coreTeamId: null as string | null,
        ballControl: null as number | null,
        passing: null as number | null,
        firstTouch: null as number | null,
        oneVOneAttacking: null as number | null,
        positioning: null as number | null,
        oneVOneDefending: null as number | null,
        decisionMaking: null as number | null,
        effort: null as number | null,
        teamplay: null as number | null,
        concentration: null as number | null,
        speed: null as number | null,
        strength: null as number | null,
        nonRotatable: false,
        preferredFoot: 'RIGHT' as string,
        bestSide: 'RIGHT' as string,
      },
      {
        id: 'p4',
        firstName: 'Diana',
        lastName: 'Ross',
        primaryPosition: null as string | null,
        secondaryPosition: null as string | null,
        tertiaryPosition: null as string | null,
        goalkeeperAbility: null as string | null,
        coreTeamId: null as string | null,
        ballControl: null as number | null,
        passing: null as number | null,
        firstTouch: null as number | null,
        oneVOneAttacking: null as number | null,
        positioning: null as number | null,
        oneVOneDefending: null as number | null,
        decisionMaking: null as number | null,
        effort: null as number | null,
        teamplay: null as number | null,
        concentration: null as number | null,
        speed: null as number | null,
        strength: null as number | null,
        nonRotatable: false,
        preferredFoot: 'RIGHT' as string,
        bestSide: 'RIGHT' as string,
      },
    ];

    const threeAvailability = [
      { playerId: 'p1', status: 'AVAILABLE' },
      { playerId: 'p2', status: 'AVAILABLE' },
      { playerId: 'p3', status: 'AVAILABLE' },
      { playerId: 'p4', status: 'AVAILABLE' },
    ];

    const overlappingMatches = [
      { id: 'match1', eventSquadId: 'squadA', startsAt: new Date('2026-07-01T11:30:00'), status: 'SCHEDULED' as const },
      { id: 'match2', eventSquadId: 'squadB', startsAt: new Date('2026-07-01T11:30:00'), status: 'SCHEDULED' as const },
    ];

    const candidates = getSupportCandidatesForEventMatch({
      targetMatch: baseTargetMatch,
      timingBySquadId: timingMap(['squadA', 'squadB', 'squadC']),
      allEventMatches: overlappingMatches,
      eventSquads: threeSquads,
      playerProfiles: threeProfiles,
      existingSupportAssignments: [],
      playerEventAvailability: threeAvailability,
    });

    const eligibleIds = candidates.filter((c) => c.available).map((c) => c.playerId);
    const ineligibleIds = candidates.filter((c) => !c.available).map((c) => c.playerId);

    expect(eligibleIds).toContain('p4');
    expect(ineligibleIds).toContain('p1');

    const lastEligibleIdx = Math.max(...candidates.map((c, i) => c.available ? i : -1));
    const firstIneligibleIdx = Math.min(...candidates.map((c, i) => !c.available ? i : Infinity));
    expect(lastEligibleIdx).toBeLessThan(firstIneligibleIdx);
  });

  it('does not sort an unrated candidate below a genuinely low-rated one (Phase 9 audit §63)', () => {
    const squads = [
      { id: 'squadA', name: 'Squad A', players: [{ playerId: 'p1' }] },
      { id: 'squadB', name: 'Squad B', players: [{ playerId: 'p2' }] },
      { id: 'squadC', name: 'Squad C', players: [{ playerId: 'p3' }] },
    ];

    const baseAttrs = {
      lastName: null, primaryPosition: null as string | null, secondaryPosition: null as string | null,
      tertiaryPosition: null as string | null, goalkeeperAbility: null as string | null, coreTeamId: null as string | null,
      nonRotatable: false, preferredFoot: 'RIGHT' as string, bestSide: 'RIGHT' as string,
    };

    const profiles = [
      // p1: unrated (every attribute null)
      {
        id: 'p1', firstName: 'Unrated', ...baseAttrs,
        ballControl: null, passing: null, firstTouch: null, oneVOneAttacking: null,
        positioning: null, oneVOneDefending: null, decisionMaking: null, effort: null,
        teamplay: null, concentration: null, speed: null, strength: null,
      },
      { id: 'p2', firstName: 'Target', ...baseAttrs, ballControl: 6, passing: 6, firstTouch: 6, oneVOneAttacking: 6, positioning: 6, oneVOneDefending: 6, decisionMaking: 6, effort: 6, teamplay: 6, concentration: 6, speed: 6, strength: 6 },
      // p3: genuinely rated low (2/10 on every attribute)
      { id: 'p3', firstName: 'LowRated', ...baseAttrs, ballControl: 2, passing: 2, firstTouch: 2, oneVOneAttacking: 2, positioning: 2, oneVOneDefending: 2, decisionMaking: 2, effort: 2, teamplay: 2, concentration: 2, speed: 2, strength: 2 },
    ];

    const availability = [
      { playerId: 'p1', status: 'AVAILABLE' },
      { playerId: 'p2', status: 'AVAILABLE' },
      { playerId: 'p3', status: 'AVAILABLE' },
    ];

    const candidates = getSupportCandidatesForEventMatch({
      targetMatch: baseTargetMatch, // targets squadB (p2), leaving p1 and p3 both eligible
      timingBySquadId: timingMap(['squadA', 'squadB', 'squadC']),
      allEventMatches: baseAllMatches,
      eventSquads: squads,
      playerProfiles: profiles,
      existingSupportAssignments: [],
      playerEventAvailability: availability,
    });

    const eligible = candidates.filter((c) => c.available);
    const unratedIndex = eligible.findIndex((c) => c.playerId === 'p1');
    const lowRatedIndex = eligible.findIndex((c) => c.playerId === 'p3');
    expect(unratedIndex).toBeGreaterThanOrEqual(0);
    expect(lowRatedIndex).toBeGreaterThanOrEqual(0);
    expect(unratedIndex).toBeLessThan(lowRatedIndex);
  });

  it('resolves each squad using its own effective timing (mixed formats, e.g. 7v7 2x17 + 9v9 2x20)', () => {
    // squadA plays 2x17 (34 total), squadB plays 2x20 (40 total). Target match (squadB) starts
    // at 11:30, so its window is 11:30-12:10. squadA's match starts at 11:00 -- with a 17-minute
    // half duration its window is 11:00-11:34, which does NOT overlap the target -- but if the
    // resolver incorrectly used squadB's 20-minute duration for squadA's match, the window would
    // extend to 11:00-11:40, which also would not overlap either. Use a tighter start time to
    // actually distinguish the two: squadA's match at 11:05 with real 17-min halves (2x17=34,
    // ends 11:39) does not overlap target's 11:30 start... use overlapping timing instead.
    const mixedAllMatches = [
      { id: 'match1', eventSquadId: 'squadA', startsAt: new Date('2026-07-01T10:50:00'), status: 'SCHEDULED' as const },
      { id: 'match2', eventSquadId: 'squadB', startsAt: new Date('2026-07-01T11:30:00'), status: 'SCHEDULED' as const },
    ];
    const mixedTiming = new Map<string, EventSquadMatchTiming>([
      ['squadA', { numberOfHalves: 2, matchDurationMinutes: 17, breakDurationMinutes: 1 }],
      ['squadB', { numberOfHalves: 2, matchDurationMinutes: 20, breakDurationMinutes: 1 }],
    ]);
    // squadA's window: 10:50 + (2*17+1)=35min -> ends 11:25. Does not overlap target's 11:30 start.
    const candidatesNoOverlap = getSupportCandidatesForEventMatch({
      targetMatch: baseTargetMatch,
      timingBySquadId: mixedTiming,
      allEventMatches: mixedAllMatches,
      eventSquads: baseSquads,
      playerProfiles: baseProfiles,
      existingSupportAssignments: [],
      playerEventAvailability: baseAvailability,
    });
    const p1NoOverlap = candidatesNoOverlap.find((c) => c.playerId === 'p1');
    expect(p1NoOverlap!.available).toBe(true);

    // If squadA's match instead started at 10:56, its 35-minute window ends 11:31, which DOES
    // overlap the target's 11:30 start -- proving squadA's own (not squadB's) duration was used.
    const overlappingAllMatches = [
      { id: 'match1', eventSquadId: 'squadA', startsAt: new Date('2026-07-01T10:56:00'), status: 'SCHEDULED' as const },
      { id: 'match2', eventSquadId: 'squadB', startsAt: new Date('2026-07-01T11:30:00'), status: 'SCHEDULED' as const },
    ];
    const candidatesOverlap = getSupportCandidatesForEventMatch({
      targetMatch: baseTargetMatch,
      timingBySquadId: mixedTiming,
      allEventMatches: overlappingAllMatches,
      eventSquads: baseSquads,
      playerProfiles: baseProfiles,
      existingSupportAssignments: [],
      playerEventAvailability: baseAvailability,
    });
    const p1Overlap = candidatesOverlap.find((c) => c.playerId === 'p1');
    expect(p1Overlap!.available).toBe(false);
    expect(p1Overlap!.unavailableReason).toBe('Own squad has overlapping match');
  });
});

describe('checkSupportConflicts', () => {
  it('flags conflict when own squad has overlapping match', () => {
    const result = checkSupportConflicts({
      assignments: [{
        id: 'a1',
        eventMatchId: 'match2',
        playerId: 'p1',
        sourceEventSquadId: 'squadA',
        targetEventSquadId: 'squadB',
        plannedRole: null,
        note: null,
      }],
      allEventMatches: [
        { id: 'match1', eventSquadId: 'squadA', startsAt: new Date('2026-07-01T11:30:00'), status: 'SCHEDULED' },
        { id: 'match2', eventSquadId: 'squadB', startsAt: new Date('2026-07-01T11:30:00'), status: 'SCHEDULED' },
      ],
      timingBySquadId: timingMap(['squadA', 'squadB']),
      eventSquads: [
        { id: 'squadA', name: 'Squad A', players: [{ playerId: 'p1' }] },
        { id: 'squadB', name: 'Squad B', players: [] },
      ],
      playerEventAvailability: [{ playerId: 'p1', status: 'AVAILABLE' }],
      playerNames: new Map([['p1', { firstName: 'Alice', lastName: 'Smith' }]]),
      squadNames: new Map([['squadA', 'Squad A'], ['squadB', 'Squad B']]),
    });

    expect(result[0]!.isConflict).toBe(true);
    expect(result[0]!.conflictReason).toBe('Own squad now has overlapping match');
  });

  it('returns no conflict for valid assignment', () => {
    const result = checkSupportConflicts({
      assignments: [{
        id: 'a1',
        eventMatchId: 'match2',
        playerId: 'p1',
        sourceEventSquadId: 'squadA',
        targetEventSquadId: 'squadB',
        plannedRole: null,
        note: null,
      }],
      allEventMatches: [
        { id: 'match1', eventSquadId: 'squadA', startsAt: new Date('2026-07-01T11:00:00'), status: 'SCHEDULED' },
        { id: 'match2', eventSquadId: 'squadB', startsAt: new Date('2026-07-01T12:00:00'), status: 'SCHEDULED' },
      ],
      timingBySquadId: timingMap(['squadA', 'squadB']),
      eventSquads: [
        { id: 'squadA', name: 'Squad A', players: [{ playerId: 'p1' }] },
        { id: 'squadB', name: 'Squad B', players: [] },
      ],
      playerEventAvailability: [{ playerId: 'p1', status: 'AVAILABLE' }],
      playerNames: new Map([['p1', { firstName: 'Alice', lastName: 'Smith' }]]),
      squadNames: new Map([['squadA', 'Squad A'], ['squadB', 'Squad B']]),
    });

    expect(result[0]!.isConflict).toBe(false);
    expect(result[0]!.conflictReason).toBeNull();
  });

  it('flags conflict when duration is not set', () => {
    const result = checkSupportConflicts({
      assignments: [{
        id: 'a1',
        eventMatchId: 'match2',
        playerId: 'p1',
        sourceEventSquadId: 'squadA',
        targetEventSquadId: 'squadB',
        plannedRole: null,
        note: null,
      }],
      allEventMatches: [
        { id: 'match2', eventSquadId: 'squadB', startsAt: new Date('2026-07-01T12:00:00'), status: 'SCHEDULED' },
      ],
      timingBySquadId: timingMap(['squadB'], { matchDurationMinutes: null }),
      eventSquads: [],
      playerEventAvailability: [],
      playerNames: new Map([['p1', { firstName: 'Alice', lastName: 'Smith' }]]),
      squadNames: new Map([['squadA', 'Squad A']]),
    });

    expect(result[0]!.isConflict).toBe(true);
    expect(result[0]!.conflictReason).toBe('Event match duration not set');
  });
});
