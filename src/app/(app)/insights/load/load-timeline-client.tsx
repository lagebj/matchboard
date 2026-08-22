"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";
import type { LoadTimelineRow } from "@/lib/insights/insights-types";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { MatrixMobileCard } from "@/components/insights/matrix-mobile-card";

type LeagueSeasonOption = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

type LoadTimelineClientProps = {
  leagueSeasons: LeagueSeasonOption[];
  activeLeagueSeasonId: string | null;
  teams: Array<{ id: string; name: string }>;
};

const LOAD_CELL_STYLES: Record<string, string> = {
  actual_appearance: "bg-emerald-800/40 text-emerald-200",
  helper_appearance: "bg-cyan-800/40 text-cyan-200",
  planned_only: "bg-blue-900/25 text-blue-300",
  unavailable: "bg-zinc-800/50 text-zinc-500",
};

const LOAD_CELL_LABELS: Record<string, string> = {
  actual_appearance: "Played",
  helper_appearance: "Helper",
  planned_only: "Planned",
  unavailable: "Not playing",
};

const ATTENTION_FLAG_LABELS: Record<string, string> = {
  high_recent_load: "High recent participation",
  no_actual_opportunity: "No match opportunity in selected horizon",
  planned_but_absent: "Planned but absent",
  report_missing: "Missing post-match report",
  low_period_participation: "Low participation this period",
};

type TeamFilter = "all" | string;
type LoadFilter = "all" | "high_load" | "low_load" | "helpers";

export function LoadTimelineClient({
  leagueSeasons,
  activeLeagueSeasonId,
  teams,
}: LoadTimelineClientProps) {
  const [selectedPeriodId, setSelectedPeriodId] = useState(
    activeLeagueSeasonId ?? leagueSeasons[0]?.id ?? "",
  );
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("all");
  const [loadFilter, setLoadFilter] = useState<LoadFilter>("all");
  const [timeline, setTimeline] = useState<LoadTimelineRow[] | null>(null);
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
      const res = await fetch(`/api/insights/load?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTimeline(data.timeline ?? []);
      }
    });
  }, [selectedPeriodId, teamFilter]);

  const filteredRows = (timeline ?? []).filter((row) => {
    if (loadFilter === "all") return true;
    if (loadFilter === "high_load")
      return row.attentionFlags.includes("high_recent_load");
    if (loadFilter === "low_load")
      return row.attentionFlags.includes("low_period_participation");
    if (loadFilter === "helpers")
      return row.cells.some((c) => c.status === "helper_appearance");
    return true;
  });

  const rounds =
    timeline?.[0]?.cells?.map((c) => ({
      id: c.matchRoundId,
      label: c.matchRoundLabel,
    })) ?? [];

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
            <BarChart3 className="h-5 w-5" />
            Load Timeline
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Match load per player over time — identify high recent load and rest patterns
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {leagueSeasons.length > 1 && (
          <div className="flex items-center gap-2">
            <label htmlFor="load-period-select" className="text-xs text-zinc-500">
              League season
            </label>
            <select
              id="load-period-select"
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
          <label htmlFor="load-team-filter" className="text-xs text-zinc-500">
            Team
          </label>
          <select
            id="load-team-filter"
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

        <div className="flex items-center gap-2">
          <label htmlFor="load-filter" className="text-xs text-zinc-500">
            Load
          </label>
          <select
            id="load-filter"
            value={loadFilter}
            onChange={(e) => setLoadFilter(e.target.value as LoadFilter)}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200"
          >
            <option value="all">All players</option>
            <option value="high_load">High recent load</option>
            <option value="low_load">Low participation</option>
            <option value="helpers">Helper appearances</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-[10px]">
        {Object.entries(LOAD_CELL_STYLES).map(([status, style]) => (
          <span key={status} className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${style}`}>
            {LOAD_CELL_LABELS[status] ?? status}
          </span>
        ))}
      </div>

      {isPending && !timeline && (
        <p className="text-sm text-zinc-500">Loading timeline...</p>
      )}

      {timeline && timeline.length === 0 && (
        <p className="text-sm text-zinc-500">
          No players found for the selected filters.
        </p>
      )}

      {timeline && timeline.length > 0 && (
        <ResponsiveTable
          items={filteredRows}
          getKey={(row) => row.playerId}
          renderTable={() => (
          <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/50">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="sticky left-0 z-10 bg-zinc-900 px-3 py-2 text-left text-[11px] font-medium text-zinc-400">
                  Player
                </th>
                <th className="sticky left-[140px] z-10 bg-zinc-900 px-2 py-2 text-left text-[11px] font-medium text-zinc-400">
                  Team
                </th>
                {rounds.map((r) => (
                  <th
                    key={r.id}
                    className="px-2 py-2 text-center text-[11px] font-medium text-zinc-400"
                  >
                    {r.label}
                  </th>
                ))}
                <th className="px-2 py-2 text-center text-[11px] font-medium text-zinc-400">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr
                  key={row.playerId}
                  className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                >
                  <td className="sticky left-0 z-10 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-200">
                    <div className="flex flex-col">
                      <span>{row.playerName}</span>
                      {row.attentionFlags.length > 0 && (
                        <span className="text-[10px] text-amber-400">
                          {row.attentionFlags
                            .map((f) => ATTENTION_FLAG_LABELS[f] ?? f)
                            .join(", ")}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="sticky left-[140px] z-10 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-400">
                    {row.coreTeamName ?? "—"}
                  </td>
                  {row.cells.map((cell) => (
                    <td key={cell.matchRoundId} className="px-1 py-1.5 text-center">
                      <span
                        className={`inline-block min-w-[28px] rounded px-1 py-0.5 text-[10px] font-medium ${
                          LOAD_CELL_STYLES[cell.status] ?? "bg-zinc-800 text-zinc-400"
                        }`}
                        title={`${cell.status} (${cell.matchCount})`}
                      >
                        {cell.matchCount > 0 ? cell.matchCount : "—"}
                      </span>
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-center text-xs font-semibold text-zinc-200">
                    {row.recentLoad}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          )}
          renderCard={(row) => (
            <MatrixMobileCard
              title={row.playerName}
              subtitle={row.coreTeamName ?? "—"}
              note={
                row.attentionFlags.length > 0
                  ? row.attentionFlags.map((f) => ATTENTION_FLAG_LABELS[f] ?? f).join(", ")
                  : undefined
              }
              cells={row.cells.map((cell) => ({
                key: cell.matchRoundId,
                roundLabel: cell.matchRoundLabel,
                value: cell.matchCount > 0 ? cell.matchCount : "—",
                className: LOAD_CELL_STYLES[cell.status] ?? "bg-zinc-800 text-zinc-400",
                title: `${LOAD_CELL_LABELS[cell.status] ?? cell.status} (${cell.matchCount})`,
              }))}
              totals={[{ label: "Total", value: row.recentLoad }]}
            />
          )}
        />
      )}
    </div>
  );
}