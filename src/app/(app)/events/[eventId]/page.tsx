import { notFound } from 'next/navigation';
import { getEventById, getAvailablePlayersForEvent } from '../actions';
import { EventDetail } from './event-detail';
import { computeSquadBalance } from '@/lib/events/event-balance';
import { validateEventPool } from '@/lib/events/event-validation';
import { toPlayerAttributeProfile } from '@/lib/events/player-event-profile';
import { getPlayerOverallRating, getAverageRating } from '@/lib/ratings/player-rating';
import { suggestBestFormationForPlayers } from '@/lib/events/tactic-suggestion';
import type { GameFormat } from '@/lib/events/event-types';
import type { TacticSuggestion } from '@/lib/events/tactic-suggestion';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Event detail' };

const VALID_GAME_FORMATS: GameFormat[] = ['THREE_A_SIDE', 'FIVE_A_SIDE', 'SEVEN_A_SIDE', 'NINE_A_SIDE', 'ELEVEN_A_SIDE'];

function toGameFormat(gf: string): GameFormat {
  return VALID_GAME_FORMATS.includes(gf as GameFormat) ? (gf as GameFormat) : 'SEVEN_A_SIDE';
}

export default async function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const [event, allActivePlayers, compatibleFormations] = await Promise.all([
    getEventById(eventId),
    getAvailablePlayersForEvent(),
    getCompatibleFormationsForEvent(eventId),
  ]);

  if (!event) notFound();

  const eventPlayerIds = new Set(event.players.map((ep) => ep.playerId));

  const playerById = new Map(event.players.map((ep) => [ep.playerId, ep.player]));

  const addablePlayers = allActivePlayers
    .filter((p) => !eventPlayerIds.has(p.id))
    .map((p) => {
      const rating = getPlayerOverallRating(p);
      return {
        playerId: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        coreTeamId: p.coreTeamId,
        coreTeamName: p.coreTeam?.name ?? null,
        primaryPosition: p.primaryPosition,
        secondaryPosition: p.secondaryPosition,
        tertiaryPosition: p.tertiaryPosition,
        goalkeeperAbility: p.goalkeeperAbility ?? 'NO',
        overallLevel: rating.value,
        ratedAttributeCount: rating.ratedAttributeCount,
        isGK: p.goalkeeperAbility === 'YES' || p.goalkeeperAbility === 'EMERGENCY',
      };
    });

  const squads = event.squads.map((s) => ({
    id: s.id,
    name: s.name,
    intent: s.intent as string,
    targetSize: s.targetSize,
    minSize: s.minSize,
    maxSize: s.maxSize,
    formationId: s.formationId,
    generationOrder: s.generationOrder,
    players: s.players.map((p) => {
      const rating = getPlayerOverallRating(p.player);
      return {
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
        overallLevel: rating.value,
        ratedAttributeCount: rating.ratedAttributeCount,
        isGK: p.player.goalkeeperAbility === 'YES' || p.player.goalkeeperAbility === 'EMERGENCY',
      };
    }),
  }));

  const players = event.players.map((ep) => {
    const rating = getPlayerOverallRating(ep.player);
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
      overallLevel: rating.value,
      ratedAttributeCount: rating.ratedAttributeCount,
      isGK: ep.player.goalkeeperAbility === 'YES' || ep.player.goalkeeperAbility === 'EMERGENCY',
      assignedSquadId: squads.find((s) => s.players.some((sp) => sp.playerId === ep.playerId))?.id ?? null,
    };
  });

  const assignedPlayerIds = new Set(players.filter((p) => p.assignedSquadId !== null).map((p) => p.playerId));
  const availablePlayers = players.filter((p) => p.status === 'AVAILABLE');
  const unassignedPlayers = availablePlayers.filter((p) => !assignedPlayerIds.has(p.playerId));

  const gameFormat = toGameFormat(event.gameFormat);

  const squadBalances = squads.map((squad) => {
    const squadPlayerProfiles = squad.players.map((sp) => {
      const fullPlayer = playerById.get(sp.playerId);
      if (fullPlayer) {
        return toPlayerAttributeProfile(fullPlayer);
      }
      return toPlayerAttributeProfile({
        id: sp.playerId,
        firstName: sp.firstName,
        lastName: sp.lastName,
        coreTeamId: sp.coreTeamId,
        primaryPosition: sp.primaryPosition,
        secondaryPosition: sp.secondaryPosition,
        tertiaryPosition: sp.tertiaryPosition,
        goalkeeperAbility: sp.goalkeeperAbility,
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
        nonRotatable: false,
        preferredFoot: 'RIGHT',
        bestSide: 'RIGHT',
      });
    });
    return computeSquadBalance(squad.id, squad.name, squad.intent as 'COMPETITIVE' | 'BALANCED' | 'MANUAL', squadPlayerProfiles);
  });

  const availablePlayerProfiles = availablePlayers.map((p) => {
    const fullPlayer = playerById.get(p.playerId);
    if (fullPlayer) {
      return toPlayerAttributeProfile(fullPlayer);
    }
    const ap = allActivePlayers.find((a) => a.id === p.playerId);
    if (ap) {
      return toPlayerAttributeProfile(ap);
    }
    return toPlayerAttributeProfile({
      id: p.playerId,
      firstName: p.firstName,
      lastName: p.lastName,
      coreTeamId: p.coreTeamId,
      primaryPosition: p.primaryPosition,
      secondaryPosition: p.secondaryPosition,
      tertiaryPosition: p.tertiaryPosition,
      goalkeeperAbility: p.goalkeeperAbility,
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
      nonRotatable: false,
      preferredFoot: 'RIGHT',
      bestSide: 'RIGHT',
    });
  });

  const validation = validateEventPool(
    availablePlayerProfiles,
    squads.length,
    squads[0]?.targetSize ?? 7,
    gameFormat,
    [],
  );

  const tacticSuggestion = availablePlayerProfiles.length > 0
    ? suggestBestFormationForPlayers({
        players: availablePlayerProfiles,
        formations: compatibleFormations.map((f) => ({
          id: f.id,
          name: f.name,
          gameFormat: f.gameFormat,
          slots: f.slots.map((s) => ({
            roleType: s.roleType,
            acceptedPositions: (typeof s.acceptedPositionIds === 'string'
              ? s.acceptedPositionIds.split(',').map((p) => p.trim())
              : Array.isArray(s.acceptedPositionIds)
                ? (s.acceptedPositionIds as string[]).map((p) => String(p).trim())
                : []) as import('@/lib/events/event-types').BroadPosition[],
            label: s.label ?? s.roleType,
          })),
        })),
        gameFormat,
      })
    : null;

  const squadTacticSuggestions: Record<string, TacticSuggestion | null> = {};
  for (const squad of squads) {
    const squadPlayerProfiles = squad.players.map((sp) => {
      const fullPlayer = playerById.get(sp.playerId);
      if (fullPlayer) {
        return toPlayerAttributeProfile(fullPlayer);
      }
      return toPlayerAttributeProfile({
        id: sp.playerId,
        firstName: sp.firstName,
        lastName: sp.lastName,
        coreTeamId: sp.coreTeamId,
        primaryPosition: sp.primaryPosition,
        secondaryPosition: sp.secondaryPosition,
        tertiaryPosition: sp.tertiaryPosition,
        goalkeeperAbility: sp.goalkeeperAbility,
        ballControl: null, passing: null, firstTouch: null, oneVOneAttacking: null,
        positioning: null, oneVOneDefending: null, decisionMaking: null,
        effort: null, teamplay: null, concentration: null, speed: null, strength: null,
        nonRotatable: false, preferredFoot: 'RIGHT', bestSide: 'RIGHT',
      });
    });

    if (squadPlayerProfiles.length > 0 && compatibleFormations.length > 0) {
      squadTacticSuggestions[squad.id] = suggestBestFormationForPlayers({
        players: squadPlayerProfiles,
        formations: compatibleFormations.map((f) => ({
          id: f.id,
          name: f.name,
          gameFormat: f.gameFormat,
          slots: f.slots.map((s) => ({
            roleType: s.roleType,
            acceptedPositions: (typeof s.acceptedPositionIds === 'string'
              ? s.acceptedPositionIds.split(',').map((p) => p.trim())
              : Array.isArray(s.acceptedPositionIds)
                ? (s.acceptedPositionIds as string[]).map((p) => String(p).trim())
                : []) as import('@/lib/events/event-types').BroadPosition[],
            label: s.label ?? s.roleType,
          })),
        })),
        gameFormat,
      });
    } else {
      squadTacticSuggestions[squad.id] = null;
    }
  }

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
    addablePlayers,
    squadBalances,
    validation,
    compatibleFormations,
    tacticSuggestion,
    squadTacticSuggestions,
  };

  return <EventDetail data={data} />;
}

async function getCompatibleFormationsForEvent(eventId: string) {
  const { getEventById, getFormations } = await import('../actions');
  const event = await getEventById(eventId);
  if (!event) return [];
  const formations = await getFormations();
  return formations.filter((f) => f.gameFormat === event.gameFormat);
}