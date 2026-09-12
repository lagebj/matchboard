export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { requirePageActorContext } from "@/lib/auth/actor-context";
import { getTeamsResultsOverview } from "@/lib/teams/get-teams-results-overview";
import { formatPhaseDisplay } from "@/lib/date/format-phase-display";
import type { TeamPeriodResultsRow } from "@/lib/teams/get-teams-results-overview";
import { TeamPeriodSelector } from "@/components/teams/team-period-selector";
import { Surface } from "@/components/ui/surface";
import { EmptyState } from "@/components/ui/empty-state";
import { DecisionBanner } from "@/components/ui/decision-banner";
import { TeamShield } from "@/components/ui/team-shield";
import { TouchlineButton, TouchlinePageHeader } from "@/components/touchline";
import { RatingBadge } from "@/components/ratings/rating-badge";
import { Download } from "lucide-react";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { computeRoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";
import { countUnresolvedPlanningAttention } from "@/lib/teams/aggregate-team-attention";

type TeamsPageProps = {
  searchParams: Promise<{
    periodId?: string;
    error?: string;
    saved?: string;
  }>;
};

function formatSavedMessage(saved?: string): string | null {
  if (saved === "created") return "Team created.";
  if (saved === "support-updated") return "Team support and development setup updated.";
  if (saved === "deleted") return "Team removed.";
  return null;
}

function formatGd(gd: number): string {
  if (gd > 0) return `+${gd}`;
  return `${gd}`;
}

function TeamResultsRow({ row, orgSlug, attentionCount }: { row: TeamPeriodResultsRow; orgSlug: string; attentionCount: number }) {
  return (
    <tr className="hover:bg-[var(--surface-hover)] transition-colors">
      <td className="px-4 py-2.5">
        <a href={`/o/${orgSlug}/teams/${row.teamId}`} className="flex items-center gap-2 font-medium text-[var(--text-soft)] hover:text-[var(--foreground)]">
          <TeamShield teamName={row.teamName} size="sm" />
          {row.teamName}
        </a>
      </td>
      <td className="px-3 py-2.5">
        <RatingBadge rating={{ value: row.overallRatingValue, displayValue: row.overallRatingDisplay, ratedAttributeCount: row.ratedPlayerCount, maxAttributeCount: 12 }} />
      </td>
      <td className="px-3 py-2.5 text-right text-[var(--text-soft)] tabular-nums">{row.matchesPlayed}</td>
      <td className="px-3 py-2.5 text-right text-[var(--text-soft)] tabular-nums">{row.wins}-{row.draws}-{row.losses}</td>
      <td className="px-3 py-2.5 text-right text-[var(--text-soft)] tabular-nums">{row.goalsFor}</td>
      <td className="px-3 py-2.5 text-right text-[var(--text-soft)] tabular-nums">{row.goalsAgainst}</td>
      <td className={`px-3 py-2.5 text-right tabular-nums ${row.goalDifference > 0 ? "text-[var(--accent-strong)]" : row.goalDifference < 0 ? "text-[var(--danger)]" : "text-[var(--text-muted)]"}`}>
        {formatGd(row.goalDifference)}
      </td>
      <td className="px-3 py-2.5 text-right text-[var(--text-soft)] tabular-nums">{row.cleanSheets}</td>
      <td className="px-3 py-2.5 text-right text-[var(--text-muted)] tabular-nums">{row.corePlayerCount}</td>
      <td className={`px-3 py-2.5 text-right tabular-nums ${attentionCount > 0 ? "text-[var(--warning)]" : "text-[var(--text-muted)]"}`}>
        {attentionCount > 0 ? attentionCount : "—"}
      </td>
    </tr>
  );
}

function MobileTeamCard({ row, orgSlug, attentionCount }: { row: TeamPeriodResultsRow; orgSlug: string; attentionCount: number }) {
  return (
    <Surface variant="default" padding="sm">
      <div className="flex items-center justify-between">
        <a href={`/o/${orgSlug}/teams/${row.teamId}`} className="flex items-center gap-2 font-medium text-[var(--text-soft)] hover:text-[var(--foreground)]">
          <TeamShield teamName={row.teamName} size="sm" />
          {row.teamName}
        </a>
        <span className="text-xs text-[var(--text-muted)] tabular-nums">{row.matchesPlayed} played</span>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-[var(--text-soft)] tabular-nums">{row.wins}-{row.draws}-{row.losses}</span>
        <RatingBadge rating={{ value: row.overallRatingValue, displayValue: row.overallRatingDisplay, ratedAttributeCount: row.ratedPlayerCount, maxAttributeCount: 12 }} />
      </div>
      <div className="flex items-center justify-between mt-0.5">
        <span className="text-[10px] text-[var(--text-muted)] tabular-nums">
          GF {row.goalsFor} · GA {row.goalsAgainst} · GD {formatGd(row.goalDifference)}
        </span>
        <span className="text-[10px] text-[var(--text-muted)]">Clean sheets {row.cleanSheets}</span>
      </div>
      {attentionCount > 0 && (
        <div className="mt-1 text-[10px] text-[var(--warning)]">{attentionCount} needs attention</div>
      )}
    </Surface>
  );
}

export default async function TeamsPage({ params, searchParams }: { params: Promise<{ orgSlug: string }>; searchParams: TeamsPageProps["searchParams"] }) {
  const { orgSlug } = await params;
  const ctx = await requirePageActorContext(orgSlug);
  setTenantOrganisationId(ctx.organisationId);
  const { periodId, error, saved } = await searchParams;

  const leagueSeasons = await db.leagueSeason.findMany({
    where: { ...ctx.orgFilter.filter },
    orderBy: { startDate: "desc" },
    select: { id: true, name: true, startDate: true, endDate: true },
  });

  const selectedPeriodId = periodId ?? leagueSeasons[0]?.id;

  const overview = selectedPeriodId
    ? await getTeamsResultsOverview(selectedPeriodId, ctx.orgFilter)
    : null;

  // Touchline Design Atlas (ADR-0136 Phase 6, `09_ROUTE_COMPOSITION_OPPONENTS_TEAMS_SEASON.md
  // §C`): "unresolved planning attention" -- a real, previously-unwired `TeamOverviewViewModel`
  // field. Resolve each team's most recent round in the selected league season (one batched
  // query), call the canonical `computeRoundPlanIntegrity()` once per *distinct* round found
  // (never once per team -- teams sharing a round cadence collapse to very few calls), and count
  // active TeamFocus rows per team (one batched query). "Recent result"/"current season
  // participation balance summary" from the same spec bullet are deliberately not added here --
  // the existing aggregate W-D-L/GF/GA/GD already substantially serves "recent result" at a
  // season scope, and no existing data owner computes a "participation balance" metric; inventing
  // one would be the exact kind of unowned metric this program's provenance doc disallows.
  const attentionByTeamId = new Map<string, number>();
  if (overview && overview.rows.length > 0) {
    const teamIds = overview.rows.map((r) => r.teamId);
    const latestMatches = await db.match.findMany({
      where: { teamId: { in: teamIds }, matchRound: { leagueSeasonId: selectedPeriodId }, status: { not: "CANCELLED" }, ...ctx.orgFilter.filter },
      select: { teamId: true, matchRoundId: true, startsAt: true },
      orderBy: { startsAt: "desc" },
    });
    const latestRoundIdByTeamId = new Map<string, string>();
    for (const m of latestMatches) {
      if (!latestRoundIdByTeamId.has(m.teamId)) latestRoundIdByTeamId.set(m.teamId, m.matchRoundId);
    }
    const distinctRoundIds = [...new Set(latestRoundIdByTeamId.values())];
    const roundIntegrities = await Promise.all(distinctRoundIds.map((id) => computeRoundPlanIntegrity(id)));
    const allSignals = roundIntegrities.flatMap((r) => r.signals);
    const activeFocuses = await db.teamFocus.findMany({
      where: { teamId: { in: teamIds }, status: "ACTIVE", ...ctx.orgFilter.filter },
      select: { teamId: true },
    });
    const counts = countUnresolvedPlanningAttention(teamIds, allSignals, activeFocuses);
    for (const [teamId, count] of counts) attentionByTeamId.set(teamId, count);
  }

  const selectedPeriod = selectedPeriodId
    ? leagueSeasons.find((p) => p.id === selectedPeriodId)
    : leagueSeasons[0];

  const periodLabel = selectedPeriod
    ? formatPhaseDisplay({
        seasonName: selectedPeriod.name,
        phaseName: selectedPeriod.name,
        startDate: new Date(selectedPeriod.startDate),
        endDate: new Date(selectedPeriod.endDate),
      }).combinedLabel
    : "No phase";

  const periodOptions = leagueSeasons.map((p) => ({
    id: p.id,
    label: formatPhaseDisplay({
      seasonName: p.name,
      phaseName: p.name,
      startDate: new Date(p.startDate),
      endDate: new Date(p.endDate),
    }).combinedLabel,
  }));

  return (
    // Touchline island (theme-aware — Phase 10 preparatory pass, ADR-0134).
    <div className="touchline flex flex-col gap-4">
      <TouchlinePageHeader
        title="Teams"
        context={`Results and match record for ${periodLabel}.`}
        actions={
          <div className="flex items-center gap-2">
            {selectedPeriodId && (
              <TouchlineButton variant="secondary" size="sm" as="a" href={`/o/${orgSlug}/teams/export?leagueSeasonId=${selectedPeriodId}`} download>
                <Download className="mr-1 h-4 w-4" />
                Export teams
              </TouchlineButton>
            )}
            <TouchlineButton variant="primary" size="sm" as="a" href={`/o/${orgSlug}/teams/new`}>
              Add team
            </TouchlineButton>
          </div>
        }
      />

      {error && <DecisionBanner variant="blocked" title={error} />}
      {formatSavedMessage(saved) && <DecisionBanner variant="success" title={formatSavedMessage(saved)!} />}

      <div className="flex items-center justify-between gap-2">
        {selectedPeriodId && (
          <TeamPeriodSelector leagueSeasons={periodOptions} selectedPeriodId={selectedPeriodId} />
        )}
      </div>

      {!selectedPeriodId ? (
        <EmptyState
          title="No phase available"
          description="Create matches and a phase before team results can be shown."
        />
      ) : !overview || overview.rows.length === 0 ? (
        <EmptyState
          title="No teams yet"
          description="Create a team to start planning squads."
          illustration="emptyPlayers"
          action={
            <TouchlineButton variant="primary" size="sm" as="a" href={`/o/${orgSlug}/teams/new`}>
              Create a team
            </TouchlineButton>
          }
        />
      ) : (
        <>
          <div className="hidden sm:block overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-soft)] bg-[var(--surface-muted)]">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Team</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Rating</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Played</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">W-D-L</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">GF</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">GA</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">GD</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Clean sheets</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Core players</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Attention</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)]">
                {overview.rows.map((row) => (
                  <TeamResultsRow key={row.teamId} row={row} orgSlug={orgSlug} attentionCount={attentionByTeamId.get(row.teamId) ?? 0} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-2 sm:hidden">
            {overview.rows.map((row) => (
              <MobileTeamCard key={row.teamId} row={row} orgSlug={orgSlug} attentionCount={attentionByTeamId.get(row.teamId) ?? 0} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}