import { getEventMatchWindow, isPlayerAvailableForSupport, eventMatchWindowsOverlap } from './event-match-time';
import type { EventMatchWindow } from './event-match-time';
import { getPlayerOverallRating, NEUTRAL_UNRATED_RATING } from '@/lib/ratings/player-rating';
import type { EventSquadMatchTiming } from './event-types';

/**
 * Resolves one match's window using its OWN squad's effective timing -- required because
 * different squads in the same Event can have different effective game formats and therefore
 * different halves/duration/break (see getEffectiveEventSquadMatchTiming, event-types.ts). A
 * match whose squad has no resolvable duration set is left out of overlap consideration entirely
 * (returns null) rather than treated as an infinite/zero-length window.
 */
export function resolveMatchWindow(
  match: { id: string; eventSquadId: string; startsAt: Date; status: string },
  timingBySquadId: Map<string, EventSquadMatchTiming>,
): EventMatchWindow | null {
  const timing = timingBySquadId.get(match.eventSquadId);
  if (!timing || !timing.matchDurationMinutes || timing.matchDurationMinutes <= 0) return null;
  return getEventMatchWindow(match, timing.matchDurationMinutes, timing.numberOfHalves, timing.breakDurationMinutes);
}

export type EventSupportCandidate = {
  playerId: string;
  firstName: string;
  lastName: string | null;
  sourceEventSquadId: string;
  sourceEventSquadName: string;
  primaryPosition: string | null;
  secondaryPosition: string | null;
  tertiaryPosition: string | null;
  goalkeeperAbility: string | null;
  overallLevel: number | null;
  isGK: boolean;
  available: boolean;
  unavailableReason: string | null;
};

export type SupportAssignmentWithConflict = {
  id: string;
  eventMatchId: string;
  playerId: string;
  sourceEventSquadId: string;
  targetEventSquadId: string;
  plannedRole: string | null;
  note: string | null;
  firstName: string;
  lastName: string | null;
  sourceEventSquadName: string;
  isConflict: boolean;
  conflictReason: string | null;
};

export function getSupportCandidatesForEventMatch(input: {
  targetMatch: {
    id: string;
    eventSquadId: string;
    startsAt: Date;
    status: string;
  };
  /** Effective match timing (halves/duration/break) keyed by eventSquadId -- see
   * getEffectiveEventSquadMatchTiming (event-types.ts). Every squad in the event must have an
   * entry, since different squads can have different effective timing. */
  timingBySquadId: Map<string, EventSquadMatchTiming>;
  allEventMatches: {
    id: string;
    eventSquadId: string;
    startsAt: Date;
    status: string;
  }[];
  eventSquads: {
    id: string;
    name: string;
    players: { playerId: string }[];
  }[];
  playerProfiles: {
    id: string;
    firstName: string;
    lastName: string | null;
    primaryPosition: string | null;
    secondaryPosition: string | null;
    tertiaryPosition: string | null;
    goalkeeperAbility: string | null;
    coreTeamId: string | null;
    ballControl: number | null;
    passing: number | null;
    firstTouch: number | null;
    oneVOneAttacking: number | null;
    positioning: number | null;
    oneVOneDefending: number | null;
    decisionMaking: number | null;
    effort: number | null;
    teamplay: number | null;
    concentration: number | null;
    speed: number | null;
    strength: number | null;
    nonRotatable: boolean;
    preferredFoot: string;
    bestSide: string;
  }[];
  existingSupportAssignments: {
    eventMatchId: string;
    playerId: string;
    targetEventSquadId: string;
  }[];
  playerEventAvailability: { playerId: string; status: string }[];
}): EventSupportCandidate[] {
  const {
    targetMatch,
    timingBySquadId,
    allEventMatches,
    eventSquads,
    playerProfiles,
    existingSupportAssignments,
    playerEventAvailability,
  } = input;

  const targetWindow = resolveMatchWindow(targetMatch, timingBySquadId);
  if (!targetWindow) {
    return playerProfiles.map((p) => ({
      playerId: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      sourceEventSquadId: '',
      sourceEventSquadName: '',
      primaryPosition: p.primaryPosition,
      secondaryPosition: p.secondaryPosition,
      tertiaryPosition: p.tertiaryPosition,
      goalkeeperAbility: p.goalkeeperAbility,
      overallLevel: null,
      isGK: p.goalkeeperAbility === 'YES' || p.goalkeeperAbility === 'EMERGENCY',
      available: false,
      unavailableReason: 'Event match duration not set',
    }));
  }

  const allWindows = allEventMatches
    .map((m) => resolveMatchWindow(m, timingBySquadId))
    .filter((w): w is EventMatchWindow => w !== null);

  const candidates: EventSupportCandidate[] = [];

  for (const squad of eventSquads) {
    if (squad.id === targetMatch.eventSquadId) continue;

    for (const squadPlayer of squad.players) {
      const profile = playerProfiles.find((p) => p.id === squadPlayer.playerId);
      if (!profile) continue;

      const rating = getPlayerOverallRating(profile);

      const eligibility = isPlayerAvailableForSupport({
        playerId: profile.id,
        sourceEventSquadId: squad.id,
        targetEventSquadId: targetMatch.eventSquadId,
        targetMatch: targetWindow,
        allEventMatches: allWindows,
        eventSquads,
        existingSupportAssignments,
        playerEventAvailability,
      });

      candidates.push({
        playerId: profile.id,
        firstName: profile.firstName,
        lastName: profile.lastName,
        sourceEventSquadId: squad.id,
        sourceEventSquadName: squad.name,
        primaryPosition: profile.primaryPosition,
        secondaryPosition: profile.secondaryPosition,
        tertiaryPosition: profile.tertiaryPosition,
        goalkeeperAbility: profile.goalkeeperAbility,
        overallLevel: rating.value,
        isGK: profile.goalkeeperAbility === 'YES' || profile.goalkeeperAbility === 'EMERGENCY',
        available: eligibility.available,
        unavailableReason: eligibility.reason,
      });
    }
  }

  candidates.sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    if (a.sourceEventSquadName !== b.sourceEventSquadName) {
      return a.sourceEventSquadName.localeCompare(b.sourceEventSquadName);
    }
    // Phase 9 audit (§63): unrated must not sort below a genuine low rating.
    return (b.overallLevel ?? NEUTRAL_UNRATED_RATING) - (a.overallLevel ?? NEUTRAL_UNRATED_RATING);
  });

  return candidates;
}

export function checkSupportConflicts(input: {
  assignments: {
    id: string;
    eventMatchId: string;
    playerId: string;
    sourceEventSquadId: string;
    targetEventSquadId: string;
    plannedRole: string | null;
    note: string | null;
  }[];
  allEventMatches: {
    id: string;
    eventSquadId: string;
    startsAt: Date;
    status: string;
  }[];
  /** Effective match timing (halves/duration/break) keyed by eventSquadId -- see
   * getEffectiveEventSquadMatchTiming (event-types.ts). */
  timingBySquadId: Map<string, EventSquadMatchTiming>;
  eventSquads: { id: string; name: string; players: { playerId: string }[] }[];
  playerEventAvailability: { playerId: string; status: string }[];
  playerNames: Map<string, { firstName: string; lastName: string | null }>;
  squadNames: Map<string, string>;
}): SupportAssignmentWithConflict[] {
  const {
    assignments,
    allEventMatches,
    timingBySquadId,
    eventSquads,
    playerEventAvailability,
    playerNames,
    squadNames,
  } = input;

  const rawTargetMatchByAssignment = new Map(
    allEventMatches.map((m) => [m.id, m] as const),
  );
  const allWindows = allEventMatches
    .map((m) => resolveMatchWindow(m, timingBySquadId))
    .filter((w): w is EventMatchWindow => w !== null);

  return assignments.map((assignment) => {
    const rawTargetMatch = rawTargetMatchByAssignment.get(assignment.eventMatchId);
    const targetMatch = allWindows.find(
      (w) => w.eventMatchId === assignment.eventMatchId,
    );
    const name = playerNames.get(assignment.playerId);
    const firstName = name?.firstName ?? '';
    const lastName = name?.lastName ?? null;
    const sourceSquadName = squadNames.get(assignment.sourceEventSquadId) ?? '';

    if (!targetMatch || targetMatch.status === 'CANCELLED') {
      let conflictReason = 'Target match not found';
      if (targetMatch) {
        conflictReason = 'Target match is cancelled';
      } else if (rawTargetMatch) {
        conflictReason = 'Event match duration not set';
      }
      return {
        ...assignment,
        firstName,
        lastName,
        sourceEventSquadName: sourceSquadName,
        isConflict: true,
        conflictReason,
      };
    }

    const sourceSquadMatches = allWindows.filter(
      (m) => m.eventSquadId === assignment.sourceEventSquadId && m.status !== 'CANCELLED',
    );
    for (const match of sourceSquadMatches) {
      if (eventMatchWindowsOverlap(match, targetMatch)) {
        return {
          ...assignment,
          firstName,
          lastName,
          sourceEventSquadName: sourceSquadName,
          isConflict: true,
          conflictReason: 'Own squad now has overlapping match',
        };
      }
    }

    const otherAssignments = assignments.filter(
      (a) => a.playerId === assignment.playerId && a.id !== assignment.id,
    );
    for (const other of otherAssignments) {
      const otherMatch = allWindows.find(
        (w) => w.eventMatchId === other.eventMatchId,
      );
      if (otherMatch && eventMatchWindowsOverlap(otherMatch, targetMatch)) {
        return {
          ...assignment,
          firstName,
          lastName,
          sourceEventSquadName: sourceSquadName,
          isConflict: true,
          conflictReason: 'Already helping another overlapping match',
        };
      }
    }

    const sourceSquad = eventSquads.find(
      (s) => s.id === assignment.sourceEventSquadId,
    );
    if (sourceSquad) {
      const isInSquad = sourceSquad.players.some(
        (p) => p.playerId === assignment.playerId,
      );
      if (!isInSquad) {
        return {
          ...assignment,
          firstName,
          lastName,
          sourceEventSquadName: sourceSquadName,
          isConflict: true,
          conflictReason: 'Player removed from source squad',
        };
      }
    }

    const playerAvailability = playerEventAvailability.find(
      (pa) => pa.playerId === assignment.playerId,
    );
    if (
      playerAvailability &&
      (playerAvailability.status === 'UNAVAILABLE' ||
        playerAvailability.status === 'WITHDRAWN')
    ) {
      return {
        ...assignment,
        firstName,
        lastName,
        sourceEventSquadName: sourceSquadName,
        isConflict: true,
        conflictReason: 'Player unavailable for event',
      };
    }

    return {
      ...assignment,
      firstName,
      lastName,
      sourceEventSquadName: sourceSquadName,
      isConflict: false,
      conflictReason: null,
    };
  });
}

