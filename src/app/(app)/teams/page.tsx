export const dynamic = "force-dynamic";

import Link from "next/link";
import { db } from "@/lib/db";
import { getTeamsResultsOverview } from "@/lib/teams/get-teams-results-overview";
import { formatPlanningPeriodRange } from "@/lib/date/format-planning-period-range";
import type { TeamPeriodResultsRow } from "@/lib/teams/get-teams-results-overview";
import { TeamPeriodSelector } from "@/components/teams/team-period-selector";

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
    <tr className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
      <td className="px-4 py-2.5">
        <Link href={`/teams/${row.teamId}`} className="font-medium text-zinc-200 hover:text-zinc-50">
          {row.teamName}
        </Link>
      </td>
      <td className="px-3 py-2.5 text-right text-zinc-300 tabular-nums">{row.matchesPlayed}</td>
      <td className="px-3 py-2.5 text-right text-zinc-300 tabular-nums">{row.wins}-{row.draws}-{row.losses}</td>
      <td className="px-3 py-2.5 text-right text-zinc-300 tabular-nums">{row.goalsFor}</td>
      <td className="px-3 py-2.5 text-right text-zinc-300 tabular-nums">{row.goalsAgainst}</td>
      <td className={`px-3 py-2.5 text-right tabular-nums ${row.goalDifference > 0 ? "text-emerald-300" : row.goalDifference < 0 ? "text-red-300" : "text-zinc-400"}`}>
        {formatGd(row.goalDifference)}
      </td>
      <td className="px-3 py-2.5 text-right text-zinc-300 tabular-nums">{row.cleanSheets}</td>
      <td className="px-3 py-2.5 text-right text-zinc-400 tabular-nums">{row.corePlayerCount}</td>
    </tr>
  );
}

function MobileTeamCard({ row }: { row: TeamPeriodResultsRow }) {
  return (
    <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5">
      <div className="flex items-center justify-between">
        <Link href={`/teams/${row.teamId}`} className="font-medium text-zinc-200 hover:text-zinc-50">
          {row.teamName}
        </Link>
        <span className="text-xs text-zinc-400 tabular-nums">{row.matchesPlayed} played</span>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-zinc-300 tabular-nums">{row.wins}-{row.draws}-{row.losses}</span>
        <span className="text-xs text-zinc-400 tabular-nums">
          GF {row.goalsFor} · GA {row.goalsAgainst} · GD {formatGd(row.goalDifference)}
        </span>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-zinc-500">Clean sheets {row.cleanSheets}</span>
        <span className="text-[10px] text-zinc-500">Core players {row.corePlayerCount}</span>
      </div>
    </div>
  );
}

export default async function TeamsPage({ searchParams }: TeamsPageProps) {
  const { periodId, error, saved } = await searchParams;

  const planningPeriods = await db.planningPeriod.findMany({
    orderBy: { startDate: "desc" },
    select: { id: true, name: true, startDate: true, endDate: true },
  });

  const selectedPeriodId = periodId ?? planningPeriods[0]?.id;

  const overview = selectedPeriodId
    ? await getTeamsResultsOverview(selectedPeriodId)
    : null;

  const periodLabel = selectedPeriodId && overview
    ? overview.planningPeriod.displayLabel
    : planningPeriods.length > 0
      ? formatPlanningPeriodRange(
          new Date(planningPeriods[0].startDate),
          new Date(planningPeriods[0].endDate),
        )
      : "No planning period";

  const periodOptions = planningPeriods.map((p) => ({
    id: p.id,
    label: formatPlanningPeriodRange(new Date(p.startDate), new Date(p.endDate)),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Teams</h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          Results and match record for {periodLabel}.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-200">{error}</div>
      )}
      {formatSavedMessage(saved) && (
        <div className="rounded-md border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200">{formatSavedMessage(saved)}</div>
      )}

      <div className="flex items-center justify-between gap-2">
        {selectedPeriodId && (
          <TeamPeriodSelector planningPeriods={periodOptions} selectedPeriodId={selectedPeriodId} />
        )}
        <Link
          href="/teams/new"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[rgba(205,219,210,0.32)] bg-[linear-gradient(180deg,rgba(146,171,151,0.26),rgba(88,110,100,0.18))] px-4 text-sm font-semibold text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-[linear-gradient(180deg,rgba(146,171,151,0.34),rgba(88,110,100,0.26))] shrink-0"
        >
          Add team
        </Link>
      </div>

      {!selectedPeriodId ? (
        <div className="flex flex-col items-center gap-2 py-8">
          <p className="text-sm text-zinc-400">No planning period available.</p>
          <p className="text-xs text-zinc-500">Create matches and a planning period before team results can be shown.</p>
        </div>
      ) : !overview || overview.rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8">
          <p className="text-sm text-zinc-400">No teams yet.</p>
          <Link
            href="/teams/new"
            className="text-sm font-medium text-[var(--accent-strong)] hover:underline"
          >
            Create a team
          </Link>
        </div>
      ) : (
        <>
          <div className="hidden sm:block rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-soft)] bg-[var(--surface-muted)]">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Team</th>
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