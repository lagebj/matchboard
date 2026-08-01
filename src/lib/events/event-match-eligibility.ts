import { db } from '@/lib/db';

export type EligibleEventMatchPlayer = {
  playerId: string;
  firstName: string;
  lastName: string | null;
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
): Promise<EligibleEventMatchPlayer[]> {
  const match = await db.eventMatch.findUnique({
    where: { id: eventMatchId },
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
              player: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  primaryPosition: true,
                  goalkeeperAbility: true,
                },
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

  for (const sp of squad.players) {
    const attrs = await db.player.findUnique({
      where: { id: sp.playerId },
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

    const overall = attrs
      ? computeOverall(attrs.effort, attrs.oneVOneAttacking, attrs.oneVOneDefending, attrs.ballControl, attrs.positioning, attrs.decisionMaking, attrs.concentration, attrs.teamplay)
      : null;

    players.push({
      playerId: sp.playerId,
      firstName: sp.player.firstName,
      lastName: sp.player.lastName,
      source: 'squad',
      sourceSquadId: squad.id,
      sourceSquadName: squad.name,
      primaryPosition: sp.player.primaryPosition,
      goalkeeperAbility: sp.player.goalkeeperAbility,
      overallLevel: overall,
      isGK: sp.player.goalkeeperAbility === 'YES',
    });
  }

  const supportAssignments = await db.eventMatchSupportAssignment.findMany({
    where: {
      targetEventSquadId: match.eventSquadId,
      eventMatch: { status: 'SCHEDULED' },
    },
    select: {
      playerId: true,
      sourceEventSquadId: true,
      sourceEventSquad: { select: { id: true, name: true } },
    },
  });

  const playerIdsInSquad = new Set(squad.players.map((sp) => sp.playerId));

  for (const sa of supportAssignments) {
    if (playerIdsInSquad.has(sa.playerId)) continue;

    const player = await db.player.findUnique({
      where: { id: sa.playerId },
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

    const overall = computeOverall(player.effort, player.oneVOneAttacking, player.oneVOneDefending, player.ballControl, player.positioning, player.decisionMaking, player.concentration, player.teamplay);

    players.push({
      playerId: sa.playerId,
      firstName: player.firstName,
      lastName: player.lastName,
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
  playerId: string,
): Promise<{ eligible: boolean; source: 'squad' | 'helper' | null; reason?: string }> {
  const match = await db.eventMatch.findUnique({
    where: { id: eventMatchId },
    select: {
      id: true,
      eventSquadId: true,
      status: true,
      eventSquad: {
        select: {
          players: { select: { playerId: true } },
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

  const isInSquad = match.eventSquad.players.some((sp) => sp.playerId === playerId);
  if (isInSquad) {
    return { eligible: true, source: 'squad' };
  }

  const supportAssignment = await db.eventMatchSupportAssignment.findFirst({
    where: {
      targetEventSquadId: match.eventSquadId,
      playerId,
    },
  });

  if (supportAssignment) {
    return { eligible: true, source: 'helper' };
  }

  return { eligible: false, source: null, reason: 'Player is not in the squad and is not a support helper for this match' };
}

function computeOverall(
  effort: number | null,
  att: number | null,
  def: number | null,
  ball: number | null,
  pos: number | null,
  dec: number | null,
  con: number | null,
  tea: number | null,
): number | null {
  const values = [effort, att, def, ball, pos, dec, con, tea].filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}