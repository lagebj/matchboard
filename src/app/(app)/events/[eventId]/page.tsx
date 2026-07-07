import { notFound } from 'next/navigation';
import { getEventById } from '../actions';
import { EventDetail } from './event-detail';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Event detail' };

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
      firstName: p.player.firstName,
      lastName: p.player.lastName,
      coreTeamId: p.player.coreTeamId,
      primaryPosition: p.player.primaryPosition,
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
  };

  return <EventDetail data={data} />;
}