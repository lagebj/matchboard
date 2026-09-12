import { db } from "@/lib/db";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { SeasonOverviewClient } from "@/app/(app)/season/season-client";
import { CoachingIntentSelector } from "@/components/matches/coaching-intent-selector";
import { SeasonFinalizeControls } from "@/app/(app)/season/season-finalize-controls";
import { TouchlinePageHeader, TouchlineButton } from "@/components/touchline";
import { CapacityBar } from "@/components/touchline/widget/capacity-bar";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { getSeasonPlayerRoundMatrix } from "@/lib/selection/get-season-overview";
import { buildSeasonViewModel } from "@/lib/touchline/presentation/season-view-model";
import { formatPhaseDisplay } from "@/lib/date/format-phase-display";

export const dynamic = "force-dynamic";

const READINESS_LABELS: Record<string, string> = {
  EFFORT_TREND: "Effort trend falling",
  ATTENDANCE_RELIABILITY: "Low attendance reliability",
  LEARNING_BEHAVIOR: "Needs attention in learning behavior",
  TEAM_FIRST_BEHAVIOR: "Needs attention in team-first behavior",
  RESET_AFTER_ERROR_RELIABILITY: "Needs attention in reset-after-error reliability",
  COACH_TRUST: "Low coach trust",
};

export default async function SeasonPage({ params, searchParams }: { params: Promise<{ orgSlug: string }>; searchParams: Promise<{ created?: string }> }) {
  const { orgSlug } = await params;
  const { created } = await searchParams;
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);
  const orgWhere = ctx.orgFilter.filter;

  const leagueSeasons = await db.leagueSeason.findMany({
    where: orgWhere,
    orderBy: { startDate: "desc" },
    select: { id: true, name: true, startDate: true, endDate: true, status: true, finalizedAt: true, finalizedBy: true },
  });

  const activeLeagueSeason = leagueSeasons[0] ?? null;

  // Touchline Design Atlas (ADR-0136 Phase 6, `09_ROUTE_COMPOSITION_OPPONENTS_TEAMS_SEASON.md
  // §E`): "season progress by rounds/dates" + "participation coverage" -- previously absent
  // entirely; the rich player x round matrix/movement/drill-down content below (a real,
  // AGENTS.md-documented product decision, correctly left untouched) is fetched client-side by
  // `SeasonOverviewClient` via its own `/api/season/matrix` route, so this is a genuine second
  // call to the same already-established `getSeasonPlayerRoundMatrix()` (also used by that API
  // route) -- not the flagged, unbatched `getTeamSeasonMatchPhasePatterns()` that caused a real
  // CI performance regression when wired into Today (provenance §14); no such risk here.
  const seasonMatrix = activeLeagueSeason
    ? await getSeasonPlayerRoundMatrix(activeLeagueSeason.id, false)
    : null;

  const seasonSummary =
    activeLeagueSeason && seasonMatrix
      ? buildSeasonViewModel({
          leagueSeasonId: activeLeagueSeason.id,
          displayLabel: formatPhaseDisplay({
            seasonName: activeLeagueSeason.name,
            phaseName: activeLeagueSeason.name,
            startDate: new Date(activeLeagueSeason.startDate),
            endDate: new Date(activeLeagueSeason.endDate),
          }).combinedLabel,
          status: activeLeagueSeason.status,
          roundCount: seasonMatrix.roundCount,
          finalizedRoundCount: seasonMatrix.finalizedRoundCount,
          playersWithAppearance: seasonMatrix.players.filter((p) => p.totalSelections > 0).length,
          totalCorePlayers: seasonMatrix.players.length,
        })
      : null;

  const leagueSeasonIntent = activeLeagueSeason
    ? await db.coachingIntent.findFirst({
        where: { scopeType: "LEAGUE_SEASON", scopeId: activeLeagueSeason.id, ...orgWhere },
        select: { id: true, category: true },
      })
    : null;

  const readinessWarnings = await db.playerReadinessSignal.findMany({
    where: { value: { in: ["FALLING", "LOW", "NEEDS_ATTENTION"] }, ...orgWhere },
    select: {
      playerId: true,
      signalType: true,
      value: true,
    },
  });

  const readinessPlayerIds = [...new Set(readinessWarnings.map((rw) => rw.playerId))];

  const readinessPlayers = readinessPlayerIds.length > 0
    ? await db.player.findMany({
        where: { id: { in: readinessPlayerIds }, ...orgWhere },
        select: { id: true, firstName: true, lastName: true, coreTeam: { select: { id: true, name: true } } },
      })
    : [];

  const playerMap = new Map(readinessPlayers.map((p) => [p.id, p]));

  const readinessWarningData = readinessWarnings.map((rw) => {
    const player = playerMap.get(rw.playerId);
    return {
      playerId: rw.playerId,
      playerName: player ? `${player.firstName} ${player.lastName ?? ""}`.trim() : rw.playerId,
      teamName: player?.coreTeam?.name ?? "Unassigned",
      signalType: rw.signalType,
      value: rw.value,
      label: READINESS_LABELS[rw.signalType] ?? rw.signalType,
    };
  });

  return (
    // Touchline island (theme-aware, no longer dark-pinned — ADR-0134 Phase 8).
    <div className="touchline flex flex-col gap-3">
      {/* Touchline Design Atlas (ADR-0136 Phase 6, §E): a real, previously-missing gap -- this
          page had no page header/title anywhere, despite AGENTS.md's own explicit "Header:
          'Season' with subtitle 'Track load, movement, and fairness across the league
          season.'" requirement. */}
      <TouchlinePageHeader title="Season" context="Track load, movement, and fairness across the league season." />

      {seasonSummary && (
        <div className="grid grid-cols-1 gap-3 medium:grid-cols-2">
          <div className="rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-4">
            <p className="text-[12px] text-[var(--text-muted)]">Round progress</p>
            <p className="mt-1 tl-sport text-[22px] font-[650] text-[var(--foreground)]">
              {seasonSummary.finalizedRoundCount}/{seasonSummary.roundCount} rounds
            </p>
            <div className="mt-2">
              <CapacityBar value={seasonSummary.finalizedRoundCount} max={Math.max(1, seasonSummary.roundCount)} />
            </div>
          </div>
          <div className="rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-4">
            <p className="text-[12px] text-[var(--text-muted)]">Participation coverage</p>
            <p className="mt-1 tl-sport text-[22px] font-[650] text-[var(--foreground)]">
              {seasonSummary.participationCoveragePercent}%
            </p>
            <p className="mt-1 text-[12px] text-[var(--text-muted)]">
              {seasonSummary.playersWithAppearance}/{seasonSummary.totalCorePlayers} players with a finalized appearance
            </p>
          </div>
        </div>
      )}

      {created && (
        <div className="rounded-md border border-[color-mix(in_srgb,var(--success)_35%,transparent)] bg-[var(--success-subtle)] px-3 py-2 text-xs font-medium text-[var(--success)]">
          League season created.
        </div>
      )}
      <div className="flex items-center gap-3">
        <TouchlineButton as="a" href={`/o/${orgSlug}/season/new`} variant="primary" size="sm">
          Create league season
        </TouchlineButton>
      </div>
      {activeLeagueSeason && (
        <SeasonFinalizeControls
          leagueSeasonId={activeLeagueSeason.id}
          leagueSeasonName={activeLeagueSeason.name}
          status={activeLeagueSeason.status}
          finalizedAt={activeLeagueSeason.finalizedAt}
          finalizedBy={activeLeagueSeason.finalizedBy}
        />
      )}
      {activeLeagueSeason && (
        <CoachingIntentSelector
          scopeType="LEAGUE_SEASON"
          scopeId={activeLeagueSeason.id}
          currentIntent={leagueSeasonIntent?.category ?? undefined}
          currentIntentId={leagueSeasonIntent?.id ?? undefined}
          label="League season intent"
        />
      )}
      {readinessWarningData.length > 0 && (
        <div className="rounded-[var(--tl-c-radius-object)] border border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[var(--warning-subtle)] px-4 py-3">
          <p className="text-xs font-medium text-[var(--warning)]">Readiness signals requiring attention</p>
          <div className="mt-2 flex flex-col gap-1">
            {readinessWarningData.map((rw, i) => (
              <a key={i} href={`/o/${orgSlug}/players/${rw.playerId}#readiness`} className="text-[11px] text-[var(--warning)] hover:brightness-110 transition-[filter]">
                {rw.playerName} <span className="text-[var(--text-muted)]">·</span> {rw.teamName} <span className="text-[var(--text-muted)]">·</span> {rw.label}
              </a>
            ))}
          </div>
        </div>
      )}
      <SeasonOverviewClient
        leagueSeasons={leagueSeasons.map((ls) => ({
          id: ls.id,
          name: ls.name,
          startDate: ls.startDate,
          endDate: ls.endDate,
          status: ls.status,
          finalizedAt: ls.finalizedAt,
        }))}
        activeLeagueSeasonId={activeLeagueSeason?.id ?? null}
      />
    </div>
  );
}