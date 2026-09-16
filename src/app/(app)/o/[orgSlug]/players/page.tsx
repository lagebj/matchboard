import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { getPlayersSeasonOverview, getPlayersCurrentRoundAttention, getPlayersDevelopmentOverview } from "@/lib/players/get-players-overview";
import type { PlayerSeasonOverviewRow } from "@/lib/players/get-players-overview";
import { PlayersPageClient } from "@/components/players/players-page-client";
import { getPlayerOverallRating } from "@/lib/ratings/player-rating";
import type { RatingSummary } from "@/lib/ratings/player-rating";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { resolveDefaultOperationalRoundId } from "@/lib/players/resolve-operational-round";
import { getEffectivePlayerPositionProfilesForPlayers } from "@/lib/player-development/get-effective-position-profile";
import { buildPositionMapEntries } from "@/lib/touchline/presentation/player-position-map-adapter";
import type { TouchlinePositionMapEntry } from "@/components/touchline/pitch/touchline-position-map";

type PlayersPageProps = {
  searchParams: Promise<{
    mode?: string;
    periodId?: string;
    roundId?: string;
    showRemoved?: string;
    error?: string;
    saved?: string;
  }>;
};

export default async function PlayersPage({ params, searchParams }: { params: Promise<{ orgSlug: string }>; searchParams: PlayersPageProps["searchParams"] }) {
  const { orgSlug } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);
  const { mode, periodId, roundId, showRemoved, error, saved } = await searchParams;
  const includeRemoved = showRemoved === "1";

  const orgWhere = ctx.orgFilter.filter;
  const playerFilter = includeRemoved
    ? { removedAt: { not: null } satisfies Prisma.DateTimeNullableFilter<"Player">, ...orgWhere }
    : { removedAt: null, active: true, ...orgWhere };

  const [players, activePlayerCount, removedPlayerCount, teams, leagueSeasons, matchRounds] = await Promise.all([
    db.player.findMany({
      where: playerFilter,
      include: { coreTeam: { select: { id: true, name: true, kitColor: true } } },
      orderBy: [{ coreTeam: { name: "asc" } }, { playerCode: "asc" }],
    }),
    // Loaded independently of `includeRemoved` mode — the "Active players" metric must always
    // mean active players, even while viewing removed players (02_ROUTE_COMPOSITION §4).
    db.player.count({ where: { removedAt: null, active: true, ...orgWhere } }),
    db.player.count({ where: { removedAt: { not: null }, ...orgWhere } }),
    db.team.findMany({
      where: { archivedAt: null, ...orgWhere },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.leagueSeason.findMany({
      where: orgWhere,
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, startDate: true, endDate: true },
    }),
    db.matchRound.findMany({
      where: orgWhere,
      orderBy: { name: "asc" },
      select: { id: true, name: true, leagueSeasonId: true },
    }),
  ]);

  const selectedPeriodId = periodId ?? leagueSeasons[0]?.id ?? "";

  const roundsForPeriod = matchRounds.filter((r) => r.leagueSeasonId === selectedPeriodId);

  const [seasonData, resolvedDefaultRoundId] = await Promise.all([
    selectedPeriodId
      ? getPlayersSeasonOverview(selectedPeriodId, { orgFilter: ctx.orgFilter })
      : Promise.resolve({ leagueSeason: { id: "", label: "No phase" }, seasonRows: [] as PlayerSeasonOverviewRow[] }),
    roundId
      ? Promise.resolve(undefined)
      : resolveDefaultOperationalRoundId(roundsForPeriod.map((r) => r.id), ctx.orgFilter),
  ]);

  const selectedRoundId = roundId ?? resolvedDefaultRoundId ?? (roundsForPeriod.length > 0 ? roundsForPeriod[0].id : undefined);

  const [currentRoundRows, developmentRows] = await Promise.all([
    selectedRoundId ? getPlayersCurrentRoundAttention(selectedRoundId, ctx.orgFilter) : Promise.resolve([]),
    getPlayersDevelopmentOverview(ctx.orgFilter),
  ]);

  const effectivePositionProfiles = await getEffectivePlayerPositionProfilesForPlayers(
    players.map((p) => p.id),
    ctx.orgFilter,
  );
  const effectivePositionsByPlayerId: Record<string, TouchlinePositionMapEntry[]> = {};
  for (const p of players) {
    const profile = effectivePositionProfiles.get(p.id);
    effectivePositionsByPlayerId[p.id] = profile ? buildPositionMapEntries(profile) : [];
  }

  const operationalRoundLabel = matchRounds.find((r) => r.id === selectedRoundId)?.name;

  const playerRatings = new Map<string, RatingSummary>();
  for (const p of players) {
    playerRatings.set(p.id, getPlayerOverallRating({
      ballControl: p.ballControl,
      passing: p.passing,
      firstTouch: p.firstTouch,
      oneVOneAttacking: p.oneVOneAttacking,
      positioning: p.positioning,
      oneVOneDefending: p.oneVOneDefending,
      decisionMaking: p.decisionMaking,
      effort: p.effort,
      teamplay: p.teamplay,
      concentration: p.concentration,
      speed: p.speed,
      strength: p.strength,
    }));
  }

  return (
    <PlayersPageClient
      players={players.map((p) => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        coreTeamId: p.coreTeamId,
        coreTeam: p.coreTeam ? { id: p.coreTeam.id, name: p.coreTeam.name } : null,
        coreTeamKitColor: p.coreTeam?.kitColor ?? null,
        primaryPosition: p.primaryPosition,
        currentAvailability: p.currentAvailability,
        shirtNumber: p.shirtNumber,
        nonRotatable: p.nonRotatable,
        reducedMatchLoadAllowed: p.reducedMatchLoadAllowed,
        overallRating: playerRatings.get(p.id)!,
        removed: p.removedAt !== null,
      }))}
      teams={teams}
      leagueSeasons={leagueSeasons}
      matchRounds={matchRounds}
      seasonRows={seasonData.seasonRows}
      currentRoundRows={currentRoundRows}
      developmentRows={developmentRows}
      effectivePositionsByPlayerId={effectivePositionsByPlayerId}
      activePlayerCount={activePlayerCount}
      selectedPeriodId={selectedPeriodId}
      selectedRoundId={selectedRoundId}
      operationalRoundLabel={operationalRoundLabel}
      includeRemoved={includeRemoved}
      removedPlayerCount={removedPlayerCount}
      initialMode={mode}
      error={error}
      saved={saved}
    />
  );
}