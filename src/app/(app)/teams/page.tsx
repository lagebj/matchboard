export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import { getTeamsResultsOverview } from "@/lib/teams/get-teams-results-overview";
import { formatPhaseDisplay } from "@/lib/date/format-phase-display";
import type { TeamPeriodResultsRow } from "@/lib/teams/get-teams-results-overview";
import { TeamPeriodSelector } from "@/components/teams/team-period-selector";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DecisionBanner } from "@/components/ui/decision-banner";
import { PageHeader } from "@/components/ui/page-header";
import { TeamShield } from "@/components/ui/team-shield";
import { RatingBadge } from "@/components/ratings/rating-badge";

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

function TeamResultsRow({ row }: { row: TeamPeriodResultsRow }) {
  return (
    <tr className="hover:bg-[var(--surface-hover)] transition-colors">
      <td className="px-4 py-2.5">
        <Link href={`/teams/${row.teamId}`} className="flex items-center gap-2 font-medium text-zinc-200 hover:text-zinc-50">
          <TeamShield teamName={row.teamName} size="sm" />
          {row.teamName}
        </Link>
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
    </tr>
  );
}

function MobileTeamCard({ row }: { row: TeamPeriodResultsRow }) {
  return (
    <Surface variant="default" padding="sm">
      <div className="flex items-center justify-between">
        <Link href={`/teams/${row.teamId}`} className="flex items-center gap-2 font-medium text-zinc-200 hover:text-zinc-50">
          <TeamShield teamName={row.teamName} size="sm" />
          {row.teamName}
        </Link>
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
    </Surface>
  );
}

export default async function TeamsPage({ searchParams }: TeamsPageProps) {
  const ctx = await requireActorContext();
  const { periodId, error, saved } = await searchParams;

  const leagueSeasons = await db.leagueSeason.findMany({
    where: { ...(ctx.orgFilter.type === 'org' ? ctx.orgFilter.filter : {}) },
    orderBy: { startDate: "desc" },
    select: { id: true, name: true, startDate: true, endDate: true },
  });

  const selectedPeriodId = periodId ?? leagueSeasons[0]?.id;

  const overview = selectedPeriodId
    ? await getTeamsResultsOverview(selectedPeriodId, ctx.orgFilter)
    : null;

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
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Teams"
        description={`Results and match record for ${periodLabel}.`}
        actions={
          <Button variant="primary" size="sm" as="a" href="/teams/new">
            Add team
          </Button>
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
            <Button variant="primary" size="sm" as="a" href="/teams/new">
              Create a team
            </Button>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)]">
                {overview.rows.map((row) => (
                  <TeamResultsRow key={row.teamId} row={row} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-2 sm:hidden">
            {overview.rows.map((row) => (
              <MobileTeamCard key={row.teamId} row={row} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}