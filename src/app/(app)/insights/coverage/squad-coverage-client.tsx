"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import type { CoverageMatrixEntry, CoverageWarning } from "@/lib/insights/insights-types";

type LeagueSeasonOption = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

type SquadCoverageClientProps = {
  leagueSeasons: LeagueSeasonOption[];
  activeLeagueSeasonId: string | null;
  teams: Array<{ id: string; name: string }>;
};

const WARNING_LABELS: Record<CoverageWarning, string> = {
  no_goalkeeper: "No goalkeeper",
  no_primary_goalkeeper: "No primary goalkeeper",
  tertiary_goalkeeper_only: "Tertiary goalkeeper only",
  insufficient_gk_coverage: "Insufficient GK coverage",
  no_defenders: "No defenders",
  no_midfielders: "No midfielders",
  no_attackers: "No attackers",
  squad_below_minimum: "Squad below minimum",
};

const WARNING_STYLES: Record<string, string> = {
  no_goalkeeper: "bg-red-900/30 text-red-300",
  no_primary_goalkeeper: "bg-amber-900/25 text-amber-300",
  tertiary_goalkeeper_only: "bg-amber-900/25 text-amber-300",
  insufficient_gk_coverage: "bg-amber-900/25 text-amber-300",
  no_defenders: "bg-orange-900/25 text-orange-300",
  no_midfielders: "bg-orange-900/25 text-orange-300",
  no_attackers: "bg-orange-900/25 text-orange-300",
  squad_below_minimum: "bg-red-900/30 text-red-300",
};

type TeamFilter = "all" | string;

export function SquadCoverageClient({
  leagueSeasons,
  activeLeagueSeasonId,
  teams,
}: SquadCoverageClientProps) {
  const [selectedPeriodId, setSelectedPeriodId] = useState(
    activeLeagueSeasonId ?? leagueSeasons[0]?.id ?? "",
  );
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("all");
  const [coverage, setCoverage] = useState<CoverageMatrixEntry[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!selectedPeriodId) return;
    startTransition(async () => {
      const params = new URLSearchParams({
        leagueSeasonId: selectedPeriodId,
        scope: "full_year",
        context: "league",
      });
      if (teamFilter !== "all") {
        params.set("teamId", teamFilter);
      }
      const res = await fetch(`/api/insights/coverage?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCoverage(data.coverage ?? []);
      }
    });
  }, [selectedPeriodId, teamFilter]);

  const filteredEntries = (coverage ?? []).filter((e) =>
    teamFilter === "all" ? true : e.teamId === teamFilter,
  );

  const hasWarnings = filteredEntries.some((e) => e.warnings.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link
          href="/insights"
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            Squad Coverage
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Goalkeeper and position coverage per squad — spot structural gaps before matchday
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {leagueSeasons.length > 1 && (
          <div className="flex items-center gap-2">
            <label htmlFor="coverage-period-select" className="text-xs text-zinc-500">
              League season
            </label>
            <select
              id="coverage-period-select"
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200"
            >
              {leagueSeasons.map((ls) => (
                <option key={ls.id} value={ls.id}>
                  {ls.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <label htmlFor="coverage-team-filter" className="text-xs text-zinc-500">
            Team
          </label>
          <select
            id="coverage-team-filter"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200"
          >
            <option value="all">All teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isPending && !coverage && (
        <p className="text-sm text-zinc-500">Loading coverage...</p>
      )}

      {coverage && coverage.length === 0 && (
        <p className="text-sm text-zinc-500">
          No squad coverage data found for the selected season.
        </p>
      )}

      {hasWarnings && (
        <div className="rounded-xl border border-amber-800/30 bg-amber-900/10 px-4 py-3">
          <p className="text-xs font-medium text-amber-200">Coverage warnings</p>
          <div className="mt-1 flex flex-col gap-1">
            {filteredEntries
              .filter((e) => e.warnings.length > 0)
              .map((e) => (
                <div key={e.squadId} className="text-xs text-amber-300/70">
                  <span className="font-medium text-amber-200">{e.teamName}</span>{" "}
                  — {e.warnings.map((w) => WARNING_LABELS[w] ?? w).join(", ")}
                </div>
              ))}
          </div>
        </div>
      )}

      {filteredEntries.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/50">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-4 py-2 text-left text-[11px] font-medium text-zinc-400">Team</th>
                <th className="px-2 py-2 text-center text-[11px] font-medium text-zinc-400">Primary GK</th>
                <th className="px-2 py-2 text-center text-[11px] font-medium text-zinc-400">Emergency GK</th>
                <th className="px-2 py-2 text-center text-[11px] font-medium text-zinc-400">DEF</th>
                <th className="px-2 py-2 text-center text-[11px] font-medium text-zinc-400">MID</th>
                <th className="px-2 py-2 text-center text-[11px] font-medium text-zinc-400">ATT</th>
                <th className="px-2 py-2 text-center text-[11px] font-medium text-zinc-400">Unassigned</th>
                <th className="px-2 py-2 text-center text-[11px] font-medium text-zinc-400">Warnings</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => (
                <tr key={entry.squadId} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="px-4 py-2 text-sm font-medium text-zinc-200">
                    {entry.teamName}
                  </td>
                  <td className="px-2 py-2 text-center text-sm">
                    <span className={entry.goalkeeperCoverage.primary > 0 ? "text-emerald-300" : "text-red-400"}>
                      {entry.goalkeeperCoverage.primary}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center text-sm text-zinc-300">
                    {entry.goalkeeperCoverage.emergency}
                  </td>
                  <td className="px-2 py-2 text-center text-sm">
                    <span className={entry.positionCoverage.defenders > 0 ? "text-zinc-300" : "text-orange-400"}>
                      {entry.positionCoverage.defenders}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center text-sm">
                    <span className={entry.positionCoverage.midfielders > 0 ? "text-zinc-300" : "text-orange-400"}>
                      {entry.positionCoverage.midfielders}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center text-sm">
                    <span className={entry.positionCoverage.attackers > 0 ? "text-zinc-300" : "text-orange-400"}>
                      {entry.positionCoverage.attackers}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center text-sm text-zinc-500">
                    {entry.positionCoverage.unassigned}
                  </td>
                  <td className="px-2 py-2 text-center">
                    {entry.warnings.length > 0 ? (
                      <div className="flex flex-wrap gap-1 justify-center">
                        {entry.warnings.map((w) => (
                          <span
                            key={w}
                            className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${WARNING_STYLES[w] ?? "bg-zinc-800 text-zinc-400"}`}
                          >
                            {WARNING_LABELS[w] ?? w}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10px] text-emerald-400">OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}