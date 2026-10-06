import { db } from "@/lib/db";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { SeasonOverviewClient } from "@/app/(app)/season/season-client";
import { CoachingIntentSelector } from "@/components/matches/coaching-intent-selector";
import { TouchlinePageHeader } from "@/components/touchline";
import { TabRail } from "@/components/ui/tab-rail";
import { EmptyState } from "@/components/ui/empty-state";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { getSeasonReviewTabs, resolveSeasonReviewTab } from "@/lib/season/season-review-tabs";
import { buildSeasonReviewViewModel } from "@/lib/season/season-review-view-model";
import { getSeasonReviewData } from "@/lib/season/get-season-review-data";
import { SeasonReviewOverview } from "./season-review-overview";
import { SeasonReviewTeams } from "./season-review-teams";
import { SeasonReviewDevelopment } from "./season-review-development";
import { SeasonReviewOpportunity } from "./season-review-opportunity";

/**
 * Season Review (ADR-0157 slice C7, `09_SEASON_REVIEW.md`). Reframes the former `/season` matrix-
 * plus-admin page into a story-first review surface: Overview renders three to five evidence-
 * backed stories; Teams/Players/Development/Opportunity are local drill-down tabs. Season create/
 * finalize/default-format administration has moved to Settings (`SeasonAdministrationSection`) —
 * this page never renders those controls. Reached from League's new "Review season" link; this
 * route itself is unchanged (`/o/{orgSlug}/season`) and is still not a primary navigation item.
 */
export const dynamic = "force-dynamic";

const READINESS_LABELS: Record<string, string> = {
  EFFORT_TREND: "Effort trend falling",
  ATTENDANCE_RELIABILITY: "Low attendance reliability",
  LEARNING_BEHAVIOR: "Needs attention in learning behavior",
  TEAM_FIRST_BEHAVIOR: "Needs attention in team-first behavior",
  RESET_AFTER_ERROR_RELIABILITY: "Needs attention in reset-after-error reliability",
  COACH_TRUST: "Low coach trust",
};

export default async function SeasonPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ created?: string; leagueSeasonId?: string; tab?: string }>;
}) {
  const { orgSlug } = await params;
  const { created, leagueSeasonId, tab } = await searchParams;
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);
  const orgWhere = ctx.orgFilter.filter;

  const activeTab = resolveSeasonReviewTab(tab);

  const leagueSeasons = await db.leagueSeason.findMany({
    where: orgWhere,
    orderBy: { startDate: "desc" },
    select: { id: true, name: true, startDate: true, endDate: true, status: true, finalizedAt: true },
  });

  const selectedLeagueSeason = (leagueSeasonId ? leagueSeasons.find((ls) => ls.id === leagueSeasonId) : undefined) ?? leagueSeasons[0] ?? null;

  const teams = selectedLeagueSeason && activeTab === "opportunity"
    ? await db.team.findMany({ where: { ...orgWhere, archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } })
    : [];

  const leagueSeasonIntent = selectedLeagueSeason
    ? await db.coachingIntent.findFirst({
        where: { scopeType: "LEAGUE_SEASON", scopeId: selectedLeagueSeason.id, ...orgWhere },
        select: { id: true, category: true },
      })
    : null;

  // Only fetched for the tabs that actually render it — Players and Opportunity have their own
  // independent (already-batched) data sources, so there is no reason to pay for the recurring-
  // theme/trend-rollup/development-cycle-review assembly on those tabs.
  const reviewData =
    selectedLeagueSeason && (activeTab === "overview" || activeTab === "teams" || activeTab === "development")
      ? await getSeasonReviewData(ctx.organisationId, selectedLeagueSeason.id)
      : null;

  const storyViewModel = reviewData ? buildSeasonReviewViewModel(reviewData.overviewInput) : null;

  const readinessWarningData: Array<{ playerId: string; playerName: string; teamName: string; label: string }> = [];
  if (activeTab === "development") {
    const readinessWarnings = await db.playerReadinessSignal.findMany({
      where: { value: { in: ["FALLING", "LOW", "NEEDS_ATTENTION"] }, ...orgWhere },
      select: { playerId: true, signalType: true, value: true },
    });
    const readinessPlayerIds = [...new Set(readinessWarnings.map((rw) => rw.playerId))];
    const readinessPlayers = readinessPlayerIds.length > 0
      ? await db.player.findMany({
          where: { id: { in: readinessPlayerIds }, ...orgWhere },
          select: { id: true, firstName: true, lastName: true, coreTeam: { select: { name: true } } },
        })
      : [];
    const playerMap = new Map(readinessPlayers.map((p) => [p.id, p]));
    for (const rw of readinessWarnings) {
      const player = playerMap.get(rw.playerId);
      readinessWarningData.push({
        playerId: rw.playerId,
        playerName: player ? `${player.firstName} ${player.lastName ?? ""}`.trim() : rw.playerId,
        teamName: player?.coreTeam?.name ?? "Unassigned",
        label: READINESS_LABELS[rw.signalType] ?? rw.signalType,
      });
    }
  }

  const leagueSeasonOptionsForClient = leagueSeasons.map((ls) => ({
    id: ls.id,
    name: ls.name,
    startDate: ls.startDate,
    endDate: ls.endDate,
    status: ls.status,
    finalizedAt: ls.finalizedAt,
  }));

  const leagueSeasonOptionsForOpportunity = leagueSeasons.map((ls) => ({
    id: ls.id,
    name: ls.name,
    startDate: ls.startDate.toISOString(),
    endDate: ls.endDate.toISOString(),
  }));

  return (
    // Touchline island (theme-aware, no longer dark-pinned — ADR-0134 Phase 8).
    <div className="touchline flex flex-col gap-3">
      <TouchlinePageHeader title="Season Review" context="What we're learning across the league season, and where to look deeper." />

      {selectedLeagueSeason && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
          <span>
            {selectedLeagueSeason.name}
            {selectedLeagueSeason.status === "FINALIZED" ? " · Finalised" : ""}
          </span>
          {leagueSeasons.length > 1 && (
            <form method="get" className="flex items-center gap-2">
              <input type="hidden" name="tab" value={activeTab} />
              <label htmlFor="season-review-select" className="sr-only">
                Historical season
              </label>
              <select
                id="season-review-select"
                name="leagueSeasonId"
                defaultValue={selectedLeagueSeason.id}
                className="h-8 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2 text-xs text-[var(--foreground)]"
              >
                {leagueSeasons.map((ls) => (
                  <option key={ls.id} value={ls.id}>
                    {ls.name}
                    {ls.status === "FINALIZED" ? " · Finalised" : ""}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="h-8 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
              >
                View
              </button>
            </form>
          )}
        </div>
      )}

      {created && (
        <div className="rounded-md border border-[color-mix(in_srgb,var(--success)_35%,transparent)] bg-[var(--success-subtle)] px-3 py-2 text-xs font-medium text-[var(--success)]">
          League season created.
        </div>
      )}

      {!selectedLeagueSeason ? (
        <EmptyState
          title="No league season yet"
          description="Create a league season in Settings to start Season Review."
          illustration="emptyMatches"
        />
      ) : (
        <>
          <TabRail
            items={getSeasonReviewTabs().map((t) => ({ ...t, href: `?leagueSeasonId=${encodeURIComponent(selectedLeagueSeason.id)}&tab=${t.key}` }))}
            activeKey={activeTab}
            ariaLabel="Season Review tabs"
          />

          {activeTab === "overview" && storyViewModel && (
            <>
              <SeasonReviewOverview stories={storyViewModel.stories} />
              <CoachingIntentSelector
                scopeType="LEAGUE_SEASON"
                scopeId={selectedLeagueSeason.id}
                currentIntent={leagueSeasonIntent?.category ?? undefined}
                currentIntentId={leagueSeasonIntent?.id ?? undefined}
                label="League season intent"
              />
            </>
          )}

          {activeTab === "teams" && reviewData && <SeasonReviewTeams teams={reviewData.teams} movementPaths={reviewData.movementPaths} />}

          {activeTab === "players" && (
            <SeasonOverviewClient leagueSeasons={leagueSeasonOptionsForClient} activeLeagueSeasonId={selectedLeagueSeason.id} />
          )}

          {activeTab === "development" && reviewData && (
            <>
              <SeasonReviewDevelopment data={reviewData.development} />
              {readinessWarningData.length > 0 && (
                <div className="rounded-[var(--tl-c-radius-object)] border border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[var(--warning-subtle)] px-4 py-3">
                  <p className="text-xs font-medium text-[var(--warning)]">Readiness signals requiring attention</p>
                  <div className="mt-2 flex flex-col gap-1">
                    {readinessWarningData.map((rw, i) => (
                      <a
                        key={i}
                        href={`/o/${orgSlug}/players/${rw.playerId}#readiness`}
                        className="text-[11px] text-[var(--warning)] hover:brightness-110 transition-[filter]"
                      >
                        {rw.playerName} <span className="text-[var(--text-muted)]">·</span> {rw.teamName}{" "}
                        <span className="text-[var(--text-muted)]">·</span> {rw.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === "opportunity" && (
            <SeasonReviewOpportunity
              leagueSeasons={leagueSeasonOptionsForOpportunity}
              activeLeagueSeasonId={selectedLeagueSeason.id}
              teams={teams}
            />
          )}
        </>
      )}
    </div>
  );
}
