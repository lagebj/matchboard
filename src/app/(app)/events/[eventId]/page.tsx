import { notFound } from 'next/navigation';
import { getEventById } from '../actions';
import { EventDetail } from './event-detail';
import { computeSquadBalance } from '@/lib/events/event-balance';
import { validateEventPool } from '@/lib/events/event-validation';
import type { GameFormat } from '@/lib/events/event-types';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Event detail' };

const VALID_GAME_FORMATS: GameFormat[] = ['THREE_A_SIDE', 'FIVE_A_SIDE', 'SEVEN_A_SIDE', 'NINE_A_SIDE', 'ELEVEN_A_SIDE'];

function toGameFormat(gf: string): GameFormat {
  return VALID_GAME_FORMATS.includes(gf as GameFormat) ? (gf as GameFormat) : 'SEVEN_A_SIDE';
}

export default async function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const event = await getEventById(eventId);

  if (!event) notFound();

  const squads = event.squads.map((s) => ({
    id: s.id,
    name: s.name,
    intent: s.intent as string,
    targetSize: s.targetSize,
    minSize: s.minSize,
    maxSize: s.maxSize,
    formationId: s.formationId,
    generationOrder: s.generationOrder,
    players: s.players.map((p) => ({
      id: p.id,
      playerId: p.playerId,
      source: p.source as string,
      locked: p.locked,
      selectionReason: typeof p.selectionReason === 'string' ? p.selectionReason : JSON.stringify(p.selectionReason) ?? '',
      positionFitTier: p.positionFitTier,
      firstName: p.player.firstName,
      lastName: p.player.lastName,
      coreTeamId: p.player.coreTeamId,
      primaryPosition: p.player.primaryPosition,
      secondaryPosition: p.player.secondaryPosition,
      tertiaryPosition: p.player.tertiaryPosition,
      goalkeeperAbility: p.player.goalkeeperAbility ?? 'NO',
      isGK: p.player.goalkeeperAbility === 'YES' || p.player.goalkeeperAbility === 'EMERGENCY',
    })),
  }));

  const allPlayerAttrs = (p: typeof event.players[number]['player']) => [
    p.ballControl, p.passing, p.firstTouch, p.oneVOneAttacking,
    p.positioning, p.oneVOneDefending, p.decisionMaking,
    p.effort, p.teamplay, p.concentration, p.speed, p.strength,
  ];

  const players = event.players.map((ep) => {
    const attrs = allPlayerAttrs(ep.player);
    const nonNullAttrs = attrs.filter((v): v is number => v !== null);

    return {
      playerId: ep.playerId,
      status: ep.status as string,
      firstName: ep.player.firstName,
      lastName: ep.player.lastName,
      coreTeamId: ep.player.coreTeamId,
      coreTeamName: ep.player.coreTeam?.name ?? null,
      primaryPosition: ep.player.primaryPosition,
      secondaryPosition: ep.player.secondaryPosition,
      tertiaryPosition: ep.player.tertiaryPosition,
      goalkeeperAbility: ep.player.goalkeeperAbility ?? 'NO',
      overallLevel: nonNullAttrs.length > 0
        ? Math.round((nonNullAttrs.reduce((sum, v) => sum + v, 0) / nonNullAttrs.length) * 10) / 10
        : null,
      isGK: ep.player.goalkeeperAbility === 'YES' || ep.player.goalkeeperAbility === 'EMERGENCY',
      assignedSquadId: squads.find((s) => s.players.some((sp) => sp.playerId === ep.playerId))?.id ?? null,
    };
  });

  const assignedPlayerIds = new Set(players.filter((p) => p.assignedSquadId !== null).map((p) => p.playerId));
  const availablePlayers = players.filter((p) => p.status === 'AVAILABLE');
  const unassignedPlayers = availablePlayers.filter((p) => !assignedPlayerIds.has(p.playerId));

  const gameFormat = toGameFormat(event.gameFormat);

  const squadBalances = squads.map((squad) => {
    const squadPlayerProfiles = squad.players.map((sp) => ({
      playerId: sp.playerId,
      primaryPosition: sp.primaryPosition ?? 'CM',
      secondaryPosition: null as string | null,
      tertiaryPosition: null as string | null,
      goalkeeperAbility: sp.goalkeeperAbility as 'NO' | 'EMERGENCY' | 'YES',
      ballControl: null, passing: null, firstTouch: null, oneVOneAttacking: null,
      positioning: null, oneVOneDefending: null, decisionMaking: null,
      effort: null, teamplay: null, concentration: null, speed: null, strength: null,
      coreTeamId: sp.coreTeamId, nonRotatable: false, preferredFoot: 'RIGHT' as const,
      bestSide: 'RIGHT' as const, firstName: sp.firstName, lastName: sp.lastName,
    }));
    return computeSquadBalance(squad.id, squad.name, squad.intent as 'COMPETITIVE' | 'BALANCED' | 'MANUAL', squadPlayerProfiles);
  });

  const availablePlayerProfiles = availablePlayers.map((p) => ({
    playerId: p.playerId,
    primaryPosition: p.primaryPosition ?? 'CM',
    secondaryPosition: null as string | null,
    tertiaryPosition: null as string | null,
    goalkeeperAbility: p.goalkeeperAbility as 'NO' | 'EMERGENCY' | 'YES',
    ballControl: null, passing: null, firstTouch: null, oneVOneAttacking: null,
    positioning: null, oneVOneDefending: null, decisionMaking: null,
    effort: null, teamplay: null, concentration: null, speed: null, strength: null,
    coreTeamId: p.coreTeamId, nonRotatable: false, preferredFoot: 'RIGHT' as const,
    bestSide: 'RIGHT' as const, firstName: p.firstName, lastName: p.lastName,
  }));

  const validation = validateEventPool(
    availablePlayerProfiles,
    squads.length,
    squads[0]?.targetSize ?? 7,
    gameFormat,
    [],
  );

  const data = {
    id: event.id,
    name: event.name,
    eventType: event.eventType as string,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt?.toISOString() ?? null,
    gameFormat: event.gameFormat as string,
    selectionPattern: event.selectionPattern as string | null,
    notes: event.notes,
    defaultFormationId: event.defaultFormationId,
    squads,
    players,
    availablePlayers,
    unassignedPlayers,
    squadBalances,
    validation,
  };

  return <EventDetail data={data} />;
}