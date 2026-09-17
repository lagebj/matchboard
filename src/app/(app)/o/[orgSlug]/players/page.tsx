import { db } from "@/lib/db";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { getPlayersSeasonOverview, getPlayersCurrentRoundAttention, getPlayersDevelopmentOverview } from "@/lib/players/get-players-overview";
import type { PlayerSeasonOverviewRow, PlayerDevelopmentOverviewRow } from "@/lib/players/get-players-overview";
import { PlayersPageClient } from "@/components/players/players-page-client";
import { getPlayerOverallRating } from "@/lib/ratings/player-rating";
import type { RatingSummary } from "@/lib/ratings/player-rating";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { resolveDefaultOperationalRoundId } from "@/lib/players/resolve-operational-round";
import { getEffectivePlayerPositionProfilesForPlayers } from "@/lib/player-development/get-effective-position-profile";
import { buildPositionMapEntries } from "@/lib/touchline/presentation/player-position-map-adapter";
import type { TouchlinePositionMapEntry } from "@/components/touchline/pitch/touchline-position-map";
import { resolveRosterFilterFromParams, playerRosterWhere, resolvePlayerRosterState } from "@/lib/players/roster-state";

type PlayersPageProps = {
  searchParams: Promise<{
    mode?: string;
    periodId?: string;
    roundId?: string;
    roster?: string;
    /** Legacy param — honoured only when `roster` is absent (see `resolveRosterFilterFromParams`);
        no navigation this route generates writes it again. */
    showRemoved?: string;
    error?: string;
    saved?: string;
  }>;
};

const EMPTY_SEASON_RESULT = { leagueSeason: { id: "", label: "No phase" }, seasonRows: [] as PlayerSeasonOverviewRow[] };

export default async function PlayersPage({ params, searchParams }: { params: Promise<{ orgSlug: string }>; searchParams: PlayersPageProps["searchParams"] }) {
  const { orgSlug } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);
  const { mode, periodId, roundId, roster, showRemoved, error, saved } = await searchParams;
  const rosterFilter = resolveRosterFilterFromParams({ roster, showRemoved });

  const orgWhere = ctx.orgFilter.filter;
  // The player roster state (active/inactive/removed/all) resolves the loaded population — replaces the
  // prior binary `includeRemoved` toggle (roster-state-and-mobile-convergence pass §4). Tenant
  // scoping (`orgWhere`) is always merged on top, never optional.
  const playerFilter = { ...playerRosterWhere(rosterFilter), ...orgWhere };

  const [players, activePlayerCount, teams, leagueSeasons, matchRounds] = await Promise.all([
    db.player.findMany({
      where: playerFilter,
      include: { coreTeam: { select: { id: true, name: true, kitColor: true } } },
      orderBy: [{ coreTeam: { name: "asc" } }, { playerCode: "asc" }],
    }),
    // Loaded independently of `rosterFilter` — the "Active players" summary metric always means
    // the active roster, even while the coach is viewing Inactive/Removed/All (§15).
    db.player.count({ where: { removedAt: null, active: true, ...orgWhere } }),
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

  const rosterPlayerIds = players.map((p) => p.id);
  const rosterStateByPlayerId = new Map(players.map((p) => [p.id, resolvePlayerRosterState(p.active, p.removedAt)]));

  const selectedPeriodId = periodId ?? leagueSeasons[0]?.id ?? "";
  const roundsForPeriod = matchRounds.filter((r) => r.leagueSeasonId === selectedPeriodId);

  const [rosterSeasonData, activeOnlySeasonData, resolvedDefaultRoundId] = await Promise.all([
    // Population-scoped to the current roster filter: feeds the Overview table/inspector, whatever roster state is loaded. Real
    // historical stats for an inactive/removed player are aggregated here, never zeroed out (§5).
    selectedPeriodId
      ? getPlayersSeasonOverview(selectedPeriodId, { orgFilter: ctx.orgFilter, playerIds: rosterPlayerIds })
      : Promise.resolve(EMPTY_SEASON_RESULT),
    // Only fetched separately when the roster filter isn't already "active" — otherwise the two
    // queries would be identical. Feeds the Support usage summary metric (§15), independent of
    // `rosterFilter`.
    rosterFilter === "active" || !selectedPeriodId
      ? Promise.resolve(null)
      : getPlayersSeasonOverview(selectedPeriodId, { orgFilter: ctx.orgFilter }),
    roundId ? Promise.resolve(undefined) : resolveDefaultOperationalRoundId(roundsForPeriod.map((r) => r.id), ctx.orgFilter),
  ]);

  const activeSeasonRows = activeOnlySeasonData ? activeOnlySeasonData.seasonRows : rosterSeasonData.seasonRows;

  const selectedRoundId = roundId ?? resolvedDefaultRoundId ?? (roundsForPeriod.length > 0 ? roundsForPeriod[0].id : undefined);

  const [currentRoundRows, rosterDevelopmentRows, activeOnlyDevelopmentRows] = await Promise.all([
    // Deliberately active-only, unaffected by `rosterFilter` — current-round opportunity
    // semantics only ever apply to an active roster player (§7).
    selectedRoundId ? getPlayersCurrentRoundAttention(selectedRoundId, ctx.orgFilter) : Promise.resolve([]),
    getPlayersDevelopmentOverview(ctx.orgFilter, { playerIds: rosterPlayerIds }),
    rosterFilter === "active" ? Promise.resolve(null as PlayerDevelopmentOverviewRow[] | null) : getPlayersDevelopmentOverview(ctx.orgFilter),
  ]);

  const activeDevelopmentRows = activeOnlyDevelopmentRows ?? rosterDevelopmentRows;

  const effectivePositionProfiles = await getEffectivePlayerPositionProfilesForPlayers(rosterPlayerIds, ctx.orgFilter);
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
        rosterState: rosterStateByPlayerId.get(p.id) ?? "ACTIVE",
      }))}
      teams={teams}
      leagueSeasons={leagueSeasons}
      matchRounds={matchRounds}
      seasonRows={rosterSeasonData.seasonRows}
      currentRoundRows={currentRoundRows}
      developmentRows={rosterDevelopmentRows}
      activeSeasonRows={activeSeasonRows}
      activeDevelopmentRows={activeDevelopmentRows}
      effectivePositionsByPlayerId={effectivePositionsByPlayerId}
      activePlayerCount={activePlayerCount}
      selectedPeriodId={selectedPeriodId}
      selectedRoundId={selectedRoundId}
      operationalRoundLabel={operationalRoundLabel}
      rosterFilter={rosterFilter}
      initialMode={mode}
      error={error}
      saved={saved}
    />
  );
}
