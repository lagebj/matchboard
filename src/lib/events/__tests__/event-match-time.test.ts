import { describe, it, expect } from 'vitest';
import {
  getEventMatchWindow,
  eventMatchWindowsOverlap,
  isPlayerAvailableForSupport,
} from '../event-match-time';

describe('getEventMatchWindow', () => {
  it('computes end time from start time and duration', () => {
    const result = getEventMatchWindow(
      { id: 'm1', eventSquadId: 's1', startsAt: new Date('2026-07-01T11:00:00'), status: 'SCHEDULED' },
      20,
    );
    expect(result.startsAt).toEqual(new Date('2026-07-01T11:00:00'));
    expect(result.endsAt).toEqual(new Date('2026-07-01T11:20:00'));
    expect(result.eventMatchId).toBe('m1');
    expect(result.eventSquadId).toBe('s1');
  });

  it('handles 35-minute duration', () => {
    const result = getEventMatchWindow(
      { id: 'm1', eventSquadId: 's1', startsAt: new Date('2026-07-01T11:00:00'), status: 'SCHEDULED' },
      35,
    );
    expect(result.endsAt).toEqual(new Date('2026-07-01T11:35:00'));
  });

  it('handles string dates', () => {
    const result = getEventMatchWindow(
      { id: 'm1', eventSquadId: 's1', startsAt: new Date('2026-07-01T11:00:00'), status: 'SCHEDULED' },
      20,
    );
    expect(result.endsAt).toEqual(new Date('2026-07-01T11:20:00'));
  });

  it('defaults to numberOfHalves=1 (duration is the whole match)', () => {
    const withDefault = getEventMatchWindow(
      { id: 'm1', eventSquadId: 's1', startsAt: new Date('2026-07-01T11:00:00'), status: 'SCHEDULED' },
      20,
    );
    const withExplicit1 = getEventMatchWindow(
      { id: 'm1', eventSquadId: 's1', startsAt: new Date('2026-07-01T11:00:00'), status: 'SCHEDULED' },
      20,
      1,
    );
    expect(withDefault).toEqual(withExplicit1);
  });

  it('numberOfHalves=2 doubles the window (matchDurationMinutes is per half)', () => {
    const result = getEventMatchWindow(
      { id: 'm1', eventSquadId: 's1', startsAt: new Date('2026-07-01T11:00:00'), status: 'SCHEDULED' },
      20,
      2,
    );
    expect(result.endsAt).toEqual(new Date('2026-07-01T11:40:00'));
  });
});

describe('eventMatchWindowsOverlap', () => {
  it('11:00-11:20 and 11:20-11:40 do not overlap', () => {
    const a: Parameters<typeof eventMatchWindowsOverlap>[0] = {
      eventMatchId: 'm1', eventSquadId: 's1',
      startsAt: new Date('2026-07-01T11:00:00'),
      endsAt: new Date('2026-07-01T11:20:00'),
      status: 'SCHEDULED',
    };
    const b: Parameters<typeof eventMatchWindowsOverlap>[1] = {
      eventMatchId: 'm2', eventSquadId: 's2',
      startsAt: new Date('2026-07-01T11:20:00'),
      endsAt: new Date('2026-07-01T11:40:00'),
      status: 'SCHEDULED',
    };
    expect(eventMatchWindowsOverlap(a, b)).toBe(false);
  });

  it('11:00-11:20 and 11:19-11:39 overlap', () => {
    const a: Parameters<typeof eventMatchWindowsOverlap>[0] = {
      eventMatchId: 'm1', eventSquadId: 's1',
      startsAt: new Date('2026-07-01T11:00:00'),
      endsAt: new Date('2026-07-01T11:20:00'),
      status: 'SCHEDULED',
    };
    const b: Parameters<typeof eventMatchWindowsOverlap>[1] = {
      eventMatchId: 'm2', eventSquadId: 's2',
      startsAt: new Date('2026-07-01T11:19:00'),
      endsAt: new Date('2026-07-01T11:39:00'),
      status: 'SCHEDULED',
    };
    expect(eventMatchWindowsOverlap(a, b)).toBe(true);
  });

  it('11:00-11:35 and 11:30-12:05 overlap', () => {
    const a: Parameters<typeof eventMatchWindowsOverlap>[0] = {
      eventMatchId: 'm1', eventSquadId: 's1',
      startsAt: new Date('2026-07-01T11:00:00'),
      endsAt: new Date('2026-07-01T11:35:00'),
      status: 'SCHEDULED',
    };
    const b: Parameters<typeof eventMatchWindowsOverlap>[1] = {
      eventMatchId: 'm2', eventSquadId: 's2',
      startsAt: new Date('2026-07-01T11:30:00'),
      endsAt: new Date('2026-07-01T12:05:00'),
      status: 'SCHEDULED',
    };
    expect(eventMatchWindowsOverlap(a, b)).toBe(true);
  });

  it('cancelled matches do not create overlap', () => {
    const a: Parameters<typeof eventMatchWindowsOverlap>[0] = {
      eventMatchId: 'm1', eventSquadId: 's1',
      startsAt: new Date('2026-07-01T11:00:00'),
      endsAt: new Date('2026-07-01T11:35:00'),
      status: 'SCHEDULED',
    };
    const b: Parameters<typeof eventMatchWindowsOverlap>[1] = {
      eventMatchId: 'm2', eventSquadId: 's2',
      startsAt: new Date('2026-07-01T11:30:00'),
      endsAt: new Date('2026-07-01T12:05:00'),
      status: 'CANCELLED',
    };
    expect(eventMatchWindowsOverlap(a, b)).toBe(false);
  });

  it('overlap is symmetric', () => {
    const a: Parameters<typeof eventMatchWindowsOverlap>[0] = {
      eventMatchId: 'm1', eventSquadId: 's1',
      startsAt: new Date('2026-07-01T11:00:00'),
      endsAt: new Date('2026-07-01T11:20:00'),
      status: 'SCHEDULED',
    };
    const b: Parameters<typeof eventMatchWindowsOverlap>[1] = {
      eventMatchId: 'm2', eventSquadId: 's2',
      startsAt: new Date('2026-07-01T11:10:00'),
      endsAt: new Date('2026-07-01T11:30:00'),
      status: 'SCHEDULED',
    };
    expect(eventMatchWindowsOverlap(a, b)).toBe(true);
    expect(eventMatchWindowsOverlap(b, a)).toBe(true);
  });
});

describe('isPlayerAvailableForSupport', () => {
  const baseMatch: Parameters<typeof isPlayerAvailableForSupport>[0]['targetMatch'] = {
    eventMatchId: 'match2',
    eventSquadId: 'squadB',
    startsAt: new Date('2026-07-01T11:30:00'),
    endsAt: new Date('2026-07-01T11:50:00'),
    status: 'SCHEDULED',
  };

  const baseAllMatches: Parameters<typeof isPlayerAvailableForSupport>[0]['allEventMatches'] = [
    {
      eventMatchId: 'match1',
      eventSquadId: 'squadA',
      startsAt: new Date('2026-07-01T11:00:00'),
      endsAt: new Date('2026-07-01T11:20:00'),
      status: 'SCHEDULED',
    },
    {
      eventMatchId: 'match2',
      eventSquadId: 'squadB',
      startsAt: new Date('2026-07-01T11:30:00'),
      endsAt: new Date('2026-07-01T11:50:00'),
      status: 'SCHEDULED',
    },
  ];

  const baseEventSquads: Parameters<typeof isPlayerAvailableForSupport>[0]['eventSquads'] = [
    { id: 'squadA', players: [{ playerId: 'p1' }] },
    { id: 'squadB', players: [{ playerId: 'p2' }] },
  ];

  const baseAvailability: Parameters<typeof isPlayerAvailableForSupport>[0]['playerEventAvailability'] = [
    { playerId: 'p1', status: 'AVAILABLE' },
    { playerId: 'p2', status: 'AVAILABLE' },
  ];

  it('player from target squad is not eligible', () => {
    const result = isPlayerAvailableForSupport({
      playerId: 'p2',
      sourceEventSquadId: 'squadB',
      targetEventSquadId: 'squadB',
      targetMatch: baseMatch,
      allEventMatches: baseAllMatches,
      eventSquads: baseEventSquads,
      existingSupportAssignments: [],
      playerEventAvailability: baseAvailability,
    });
    expect(result.available).toBe(false);
    expect(result.reason).toBe('Already in target squad');
  });

  it('player from another squad with no overlapping match is eligible', () => {
    const result = isPlayerAvailableForSupport({
      playerId: 'p1',
      sourceEventSquadId: 'squadA',
      targetEventSquadId: 'squadB',
      targetMatch: baseMatch,
      allEventMatches: baseAllMatches,
      eventSquads: baseEventSquads,
      existingSupportAssignments: [],
      playerEventAvailability: baseAvailability,
    });
    expect(result.available).toBe(true);
    expect(result.reason).toBeNull();
  });

  it('player from squad with overlapping match is not eligible', () => {
    const overlappingMatches = [
      {
        eventMatchId: 'match1',
        eventSquadId: 'squadA',
        startsAt: new Date('2026-07-01T11:30:00'),
        endsAt: new Date('2026-07-01T11:50:00'),
        status: 'SCHEDULED',
      },
      baseMatch,
    ];
    const result = isPlayerAvailableForSupport({
      playerId: 'p1',
      sourceEventSquadId: 'squadA',
      targetEventSquadId: 'squadB',
      targetMatch: baseMatch,
      allEventMatches: overlappingMatches,
      eventSquads: baseEventSquads,
      existingSupportAssignments: [],
      playerEventAvailability: baseAvailability,
    });
    expect(result.available).toBe(false);
    expect(result.reason).toBe('Own squad has overlapping match');
  });

  it('player from squad with cancelled overlapping match is eligible', () => {
    const matchesWithCancelled = [
      {
        eventMatchId: 'match1',
        eventSquadId: 'squadA',
        startsAt: new Date('2026-07-01T11:30:00'),
        endsAt: new Date('2026-07-01T11:50:00'),
        status: 'CANCELLED',
      },
      baseMatch,
    ];
    const result = isPlayerAvailableForSupport({
      playerId: 'p1',
      sourceEventSquadId: 'squadA',
      targetEventSquadId: 'squadB',
      targetMatch: baseMatch,
      allEventMatches: matchesWithCancelled,
      eventSquads: baseEventSquads,
      existingSupportAssignments: [],
      playerEventAvailability: baseAvailability,
    });
    expect(result.available).toBe(true);
  });

  it('unavailable player is not eligible', () => {
    const result = isPlayerAvailableForSupport({
      playerId: 'p1',
      sourceEventSquadId: 'squadA',
      targetEventSquadId: 'squadB',
      targetMatch: baseMatch,
      allEventMatches: baseAllMatches,
      eventSquads: baseEventSquads,
      existingSupportAssignments: [],
      playerEventAvailability: [
        { playerId: 'p1', status: 'UNAVAILABLE' },
      ],
    });
    expect(result.available).toBe(false);
    expect(result.reason).toBe('Player unavailable for event');
  });

  it('withdrawn player is not eligible', () => {
    const result = isPlayerAvailableForSupport({
      playerId: 'p1',
      sourceEventSquadId: 'squadA',
      targetEventSquadId: 'squadB',
      targetMatch: baseMatch,
      allEventMatches: baseAllMatches,
      eventSquads: baseEventSquads,
      existingSupportAssignments: [],
      playerEventAvailability: [
        { playerId: 'p1', status: 'WITHDRAWN' },
      ],
    });
    expect(result.available).toBe(false);
    expect(result.reason).toBe('Player unavailable for event');
  });

  it('cancelled target match is not eligible', () => {
    const cancelledTarget: Parameters<typeof isPlayerAvailableForSupport>[0]['targetMatch'] = {
      ...baseMatch,
      status: 'CANCELLED',
    };
    const result = isPlayerAvailableForSupport({
      playerId: 'p1',
      sourceEventSquadId: 'squadA',
      targetEventSquadId: 'squadB',
      targetMatch: cancelledTarget,
      allEventMatches: baseAllMatches,
      eventSquads: baseEventSquads,
      existingSupportAssignments: [],
      playerEventAvailability: baseAvailability,
    });
    expect(result.available).toBe(false);
    expect(result.reason).toBe('Target match is cancelled');
  });

  it('player already helping another overlapping match is not eligible', () => {
    const anotherMatch: Parameters<typeof isPlayerAvailableForSupport>[0]['allEventMatches'][number] = {
      eventMatchId: 'match3',
      eventSquadId: 'squadC',
      startsAt: new Date('2026-07-01T11:35:00'),
      endsAt: new Date('2026-07-01T11:55:00'),
      status: 'SCHEDULED',
    };
    const result = isPlayerAvailableForSupport({
      playerId: 'p1',
      sourceEventSquadId: 'squadA',
      targetEventSquadId: 'squadB',
      targetMatch: baseMatch,
      allEventMatches: [...baseAllMatches, anotherMatch],
      eventSquads: [
        ...baseEventSquads,
        { id: 'squadC', players: [] },
      ],
      existingSupportAssignments: [
        { eventMatchId: 'match3', playerId: 'p1', targetEventSquadId: 'squadC' },
      ],
      playerEventAvailability: baseAvailability,
    });
    expect(result.available).toBe(false);
    expect(result.reason).toBe('Already helping another overlapping match');
  });

  it('player not in event pool is not eligible', () => {
    const result = isPlayerAvailableForSupport({
      playerId: 'p3',
      sourceEventSquadId: 'squadA',
      targetEventSquadId: 'squadB',
      targetMatch: baseMatch,
      allEventMatches: baseAllMatches,
      eventSquads: baseEventSquads,
      existingSupportAssignments: [],
      playerEventAvailability: baseAvailability,
    });
    expect(result.available).toBe(false);
    expect(result.reason).toBe('Player not in event pool');
  });
});