export type EventMatchWindow = {
  eventMatchId: string;
  eventSquadId: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
};

export function getEventMatchWindow(
  match: { id: string; eventSquadId: string; startsAt: Date; status: string },
  matchDurationMinutes: number,
  numberOfHalves: number = 1,
  breakDurationMinutes: number | null = null,
): EventMatchWindow {
  const startsAt = match.startsAt instanceof Date ? match.startsAt : new Date(match.startsAt);
  // matchDurationMinutes is the length of ONE half -- total playing time is numberOfHalves ×
  // that, plus (numberOfHalves - 1) breaks of breakDurationMinutes each (0/null = break length
  // not tracked, matching the pre-break-support estimate exactly).
  const breaksCount = numberOfHalves > 1 ? numberOfHalves - 1 : 0;
  const totalBreakMinutes = breaksCount * (breakDurationMinutes ?? 0);
  const endsAt = new Date(startsAt.getTime() + (numberOfHalves * matchDurationMinutes + totalBreakMinutes) * 60 * 1000);
  return {
    eventMatchId: match.id,
    eventSquadId: match.eventSquadId,
    startsAt,
    endsAt,
    status: match.status,
  };
}

export function eventMatchWindowsOverlap(
  a: EventMatchWindow,
  b: EventMatchWindow,
): boolean {
  if (a.status === 'CANCELLED' || b.status === 'CANCELLED') return false;
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

export function isPlayerAvailableForSupport(input: {
  playerId: string;
  sourceEventSquadId: string;
  targetEventSquadId: string;
  targetMatch: EventMatchWindow;
  allEventMatches: EventMatchWindow[];
  eventSquads: { id: string; players: { playerId: string }[] }[];
  existingSupportAssignments: {
    eventMatchId: string;
    playerId: string;
    targetEventSquadId: string;
  }[];
  playerEventAvailability: { playerId: string; status: string }[];
}): { available: boolean; reason: string | null } {
  const {
    playerId,
    sourceEventSquadId,
    targetEventSquadId,
    targetMatch,
    allEventMatches,
    eventSquads,
    existingSupportAssignments,
    playerEventAvailability,
  } = input;

  if (sourceEventSquadId === targetEventSquadId) {
    return { available: false, reason: 'Already in target squad' };
  }

  const playerAvailability = playerEventAvailability.find(
    (pa) => pa.playerId === playerId,
  );
  if (!playerAvailability) {
    return { available: false, reason: 'Player not in event pool' };
  }
  if (
    playerAvailability.status === 'UNAVAILABLE' ||
    playerAvailability.status === 'WITHDRAWN'
  ) {
    return { available: false, reason: 'Player unavailable for event' };
  }

  if (targetMatch.status === 'CANCELLED') {
    return { available: false, reason: 'Target match is cancelled' };
  }

  const sourceSquadMatches = allEventMatches.filter(
    (m) => m.eventSquadId === sourceEventSquadId && m.status !== 'CANCELLED',
  );
  for (const match of sourceSquadMatches) {
    if (eventMatchWindowsOverlap(match, targetMatch)) {
      return { available: false, reason: 'Own squad has overlapping match' };
    }
  }

  const otherOverlappingSupport = existingSupportAssignments.find(
    (a) =>
      a.playerId === playerId &&
      a.targetEventSquadId !== targetEventSquadId &&
      allEventMatches.some(
        (m) =>
          m.eventMatchId === a.eventMatchId &&
          m.status !== 'CANCELLED' &&
          eventMatchWindowsOverlap(m, targetMatch),
      ),
  );
  if (otherOverlappingSupport) {
    return { available: false, reason: 'Already helping another overlapping match' };
  }

  const existingForTarget = existingSupportAssignments.find(
    (a) => a.eventMatchId === targetMatch.eventMatchId && a.playerId === playerId,
  );
  if (existingForTarget) {
    return { available: false, reason: 'Already assigned as support for this match' };
  }

  const sourceSquad = eventSquads.find((s) => s.id === sourceEventSquadId);
  if (sourceSquad) {
    const isInSourceSquad = sourceSquad.players.some(
      (p) => p.playerId === playerId,
    );
    if (!isInSourceSquad) {
      return { available: false, reason: 'Player removed from source squad' };
    }
  }

  return { available: true, reason: null };
}