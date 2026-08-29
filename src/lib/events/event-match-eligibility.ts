import { db } from '@/lib/db';
import type { OrgFilterMode } from '@/lib/tenancy/resolve-org-filter';
import { getPlayerOverallRating } from '@/lib/ratings/player-rating';
import {
  resolveParticipantRef,
  type ParticipantType,
  type ParticipantPlayerLookup,
  type ParticipantGuestPlayerLookup,
} from '@/lib/participants/participant-ref';

// ADR-0106: GuestPlayer-aware canonical Event Match eligibility service. A GuestPlayer assigned
// to the match's squad is eligible on exactly the same terms as a Player -- eligibility here
// means "assignable to this match's lineup", not "scoring-engine candidate", so no rating/
// evidence semantics change. Support/helper assignments remain Player-only for now (a GuestPlayer
// is never returned with source: 'helper') -- Event Match support-helper eligibility for
// GuestPlayers is deferred to a later, separate change (event-match-support.ts's eligibility
// engine is Player-specific and substantial); this is a real, documented scope boundary, not an
// oversight.

export type EligibleEventMatchPlayer = {
  participantId: string;
  participantType: ParticipantType;
  playerId: string | null;
  guestPlayerId: string | null;
  displayName: string;
  source: 'squad' | 'helper';
  sourceSquadId: string;
  sourceSquadName: string;
  primaryPosition: string | null;
  goalkeeperAbility: string | null;
  overallLevel: number | null;
  isGK: boolean;
};

export async function getEligibleEventMatchPlayers(
  eventMatchId: string,
  orgFilter: OrgFilterMode,
): Promise<EligibleEventMatchPlayer[]> {
  const match = await db.eventMatch.findFirst({
    where: { id: eventMatchId, event: orgFilter.filter },
    select: {
      id: true,
      eventId: true,
      eventSquadId: true,
      status: true,
      eventSquad: {
        select: {
          id: true,
          name: true,
          players: {
            select: {
              playerId: true,
              guestPlayerId: true,
              player: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  primaryPosition: true,
                  goalkeeperAbility: true,
                },
              },
              guestPlayer: {
                select: { id: true, name: true, sourceLabel: true },
              },
            },
          },
        },
      },
    },
  });

  if (!match) return [];

  const squad = match.eventSquad;
  const players: EligibleEventMatchPlayer[] = [];

  const playerBackedSquadRows = squad.players.filter(
    (sp): sp is typeof sp & { playerId: string; player: NonNullable<typeof sp.player> } =>
      sp.playerId !== null && sp.player !== null,
  );
  const guestBackedSquadRows = squad.players.filter(
    (sp): sp is typeof sp & { guestPlayerId: string; guestPlayer: NonNullable<typeof sp.guestPlayer> } =>
      sp.guestPlayerId !== null && sp.guestPlayer !== null,
  );

  for (const sp of playerBackedSquadRows) {
    const attrs = await db.player.findFirst({
      where: { id: sp.playerId, ...orgFilter.filter },
      select: {
        effort: true,
        oneVOneAttacking: true,
        oneVOneDefending: true,
        ballControl: true,
        positioning: true,
        decisionMaking: true,
        concentration: true,
        teamplay: true,
      },
    });

    const overall = attrs ? getPlayerOverallRating(attrs).value : null;
    const ref = resolveParticipantRef({
      playerId: sp.playerId,
      guestPlayerId: null,
      playerLookup: new Map([[sp.playerId, sp.player]]) as ParticipantPlayerLookup,
      guestPlayerLookup: new Map() as ParticipantGuestPlayerLookup,
    });

    players.push({
      participantId: ref.participantId,
      participantType: ref.participantType,
      playerId: ref.playerId,
      guestPlayerId: ref.guestPlayerId,
      displayName: ref.displayName,
      source: 'squad',
      sourceSquadId: squad.id,
      sourceSquadName: squad.name,
      primaryPosition: sp.player.primaryPosition,
      goalkeeperAbility: sp.player.goalkeeperAbility,
      overallLevel: overall,
      isGK: sp.player.goalkeeperAbility === 'YES',
    });
  }

  // GuestPlayers are never fabricated a rating (AGENTS.md "Player attribute ratings": null means
  // "Not rated", never 0 or a team average) and are never goalkeeper-capable by inference --
  // goalkeeper coverage for a guest is a coach judgement made through position assignment, not a
  // derived attribute, since GuestPlayer carries no goalkeeperAbility field.
  for (const sp of guestBackedSquadRows) {
    const ref = resolveParticipantRef({
      playerId: null,
      guestPlayerId: sp.guestPlayerId,
      playerLookup: new Map() as ParticipantPlayerLookup,
      guestPlayerLookup: new Map([[sp.guestPlayerId, sp.guestPlayer]]) as ParticipantGuestPlayerLookup,
    });

    players.push({
      participantId: ref.participantId,
      participantType: ref.participantType,
      playerId: ref.playerId,
      guestPlayerId: ref.guestPlayerId,
      displayName: ref.displayName,
      source: 'squad',
      sourceSquadId: squad.id,
      sourceSquadName: squad.name,
      primaryPosition: null,
      goalkeeperAbility: null,
      overallLevel: null,
      isGK: false,
    });
  }

  const supportAssignments = await db.eventMatchSupportAssignment.findMany({
    where: {
      targetEventSquadId: match.eventSquadId,
      eventMatch: { status: 'SCHEDULED' },
      playerId: { not: null },
    },
    select: {
      playerId: true,
      sourceEventSquadId: true,
      sourceEventSquad: { select: { id: true, name: true } },
    },
  });

  const participantIdsInSquad = new Set(players.map((p) => p.participantId));

  for (const sa of supportAssignments) {
    if (!sa.playerId || participantIdsInSquad.has(sa.playerId)) continue;

    const player = await db.player.findFirst({
      where: { id: sa.playerId, ...orgFilter.filter },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        primaryPosition: true,
        goalkeeperAbility: true,
        effort: true,
        oneVOneAttacking: true,
        oneVOneDefending: true,
        ballControl: true,
        positioning: true,
        decisionMaking: true,
        concentration: true,
        teamplay: true,
      },
    });

    if (!player) continue;

    const overall = getPlayerOverallRating(player).value;
    const ref = resolveParticipantRef({
      playerId: sa.playerId,
      guestPlayerId: null,
      playerLookup: new Map([[sa.playerId, player]]) as ParticipantPlayerLookup,
      guestPlayerLookup: new Map() as ParticipantGuestPlayerLookup,
    });

    players.push({
      participantId: ref.participantId,
      participantType: ref.participantType,
      playerId: ref.playerId,
      guestPlayerId: ref.guestPlayerId,
      displayName: ref.displayName,
      source: 'helper',
      sourceSquadId: sa.sourceEventSquadId,
      sourceSquadName: sa.sourceEventSquad.name,
      primaryPosition: player.primaryPosition,
      goalkeeperAbility: player.goalkeeperAbility,
      overallLevel: overall,
      isGK: player.goalkeeperAbility === 'YES',
    });
  }

  return players;
}

export async function assertEligibleEventMatchPlayer(
  eventMatchId: string,
  participantId: string,
  orgFilter: OrgFilterMode,
): Promise<{ eligible: boolean; source: 'squad' | 'helper' | null; reason?: string }> {
  const match = await db.eventMatch.findFirst({
    where: { id: eventMatchId, event: orgFilter.filter },
    select: {
      id: true,
      eventSquadId: true,
      status: true,
      eventSquad: {
        select: {
          players: { select: { playerId: true, guestPlayerId: true } },
        },
      },
    },
  });

  if (!match) {
    return { eligible: false, source: null, reason: 'Match not found' };
  }

  if (match.status === 'CANCELLED') {
    return { eligible: false, source: null, reason: 'Match is cancelled' };
  }

  const isInSquad = match.eventSquad.players.some(
    (sp) => sp.playerId === participantId || sp.guestPlayerId === participantId,
  );
  if (isInSquad) {
    return { eligible: true, source: 'squad' };
  }

  const supportAssignment = await db.eventMatchSupportAssignment.findFirst({
    where: {
      targetEventSquadId: match.eventSquadId,
      playerId: participantId,
    },
  });

  if (supportAssignment) {
    return { eligible: true, source: 'helper' };
  }

  return { eligible: false, source: null, reason: 'Participant is not in the squad and is not a support helper for this match' };
}
