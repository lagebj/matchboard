import { notFound } from 'next/navigation';
import { getEventById, getAvailablePlayersForEvent } from '@/app/(app)/events/actions';
import { EventDetail } from '@/app/(app)/events/[eventId]/event-detail';
import { computeSquadBalance } from '@/lib/events/event-balance';
import { validateEventPool } from '@/lib/events/event-validation';
import { toPlayerAttributeProfile } from '@/lib/events/player-event-profile';
import { getPlayerOverallRating } from '@/lib/ratings/player-rating';
import type { GameFormat } from '@/lib/events/event-types';
import { getEffectiveEventTeamGameFormat } from '@/lib/events/event-types';
import { db } from '@/lib/db';
import { requirePageActorContext } from '@/lib/auth/actor-context';
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Event detail' };

const VALID_GAME_FORMATS: GameFormat[] = ['THREE_A_SIDE', 'FIVE_A_SIDE', 'SEVEN_A_SIDE', 'NINE_A_SIDE', 'ELEVEN_A_SIDE'];

function toGameFormat(gf: string): GameFormat {
  return VALID_GAME_FORMATS.includes(gf as GameFormat) ? (gf as GameFormat) : 'SEVEN_A_SIDE';
}

export default async function EventDetailPage({ params }: { params: Promise<{ orgSlug: string; eventId: string }> }) {
  const { orgSlug, eventId } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);
  const orgWhere = ctx.orgFilter.filter;
  const [event, allActivePlayers, compatibleFormations, opponentTeams] = await Promise.all([
    getEventById(eventId),
    getAvailablePlayersForEvent(),
    getCompatibleFormationsForEvent(eventId),
    db.opponentTeam.findMany({
      where: { archivedAt: null, ...orgWhere },
      orderBy: { displayName: 'asc' },
      select: { id: true, displayName: true },
    }),
  ]);

  if (!event) notFound();

  const eventPlayerIds = new Set(event.players.map((ep) => ep.playerId));

  const playerById = new Map(event.players.map((ep) => [ep.playerId, ep.player]));

  const formationMap = new Map(compatibleFormations.map((f) => [f.id, f]));

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

  const squads = event.squads.map((s) => {
    const formation = s.formationId ? formationMap.get(s.formationId) : (event.defaultFormationId ? formationMap.get(event.defaultFormationId) : undefined);
    return {
      id: s.id,
      name: s.name,
      intent: s.intent as string,
      targetSize: s.targetSize,
      minSize: s.minSize,
      maxSize: s.maxSize,
      formationId: s.formationId,
      formationName: formation?.name ?? null,
      gameFormatOverride: s.gameFormatOverride,
      effectiveGameFormat: getEffectiveEventTeamGameFormat(event, s),
      formationSlots: (formation?.slots ?? []).map((slot) => ({
        id: slot.id,
        roleType: slot.roleType,
        label: slot.label,
        shortLabel: slot.label,
        acceptedPositionIds: Array.isArray(slot.acceptedPositionIds) ? slot.acceptedPositionIds as string[] : [],
        gridX: slot.gridX,
        gridY: slot.gridY,
        sortOrder: slot.sortOrder,
      })),
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
          assignedSlotIndex: p.assignedSlotIndex,
          assignedSlotLabel: p.assignedSlotLabel,
          assignedRoleType: p.assignedRoleType,
          assignedPositionId: p.assignedPositionId,
          lineupOrder: p.lineupOrder,
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
    };
  });

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

  const data = {
    id: event.id,
    name: event.name,
    eventType: event.eventType as string,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt?.toISOString() ?? null,
    gameFormat: event.gameFormat as string,
    matchDurationMinutes: event.matchDurationMinutes,
    numberOfHalves: event.numberOfHalves,
    selectionPattern: event.selectionPattern as string | null,
    notes: event.notes,
    defaultFormationId: event.defaultFormationId,
    status: event.status as string,
    finalizedAt: event.finalizedAt?.toISOString() ?? null,
    finalizedBy: event.finalizedBy,
    squads,
    players,
    availablePlayers,
    unassignedPlayers,
    addablePlayers,
    squadBalances,
    validation,
    compatibleFormations,
    formationMap,
    opponentTeams,
  };

  return <EventDetail data={data} />;
}

async function getCompatibleFormationsForEvent(eventId: string) {
  const { getEventById, getFormations } = await import('@/app/(app)/events/actions');
  const event = await getEventById(eventId);
  if (!event) return [];
  const formations = await getFormations();
  return formations.filter((f) => f.gameFormat === event.gameFormat);
}