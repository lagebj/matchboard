"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Table2 } from "lucide-react";
import type { OpportunityMatrixRow, OpportunityCellStatus } from "@/lib/insights/insights-types";

type LeagueSeasonOption = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

type OpportunityMatrixClientProps = {
  leagueSeasons: LeagueSeasonOption[];
  activeLeagueSeasonId: string | null;
  teams: Array<{ id: string; name: string }>;
};

const STATUS_LABELS: Record<OpportunityCellStatus, string> = {
  planned_core: "Core",
  planned_support: "Sup",
  planned_development: "Dev",
  planned_squad_repair: "Rep",
  actual_core: "Core",
  actual_support: "Sup",
  actual_development: "Dev",
  actual_helper: "Help",
  actual_unplanned: "+",
  missed_planned_opportunity: "Miss",
  unavailable: "Unav",
  not_selected: "—",
  blocked: "Block",
  report_missing: "?",
};

const STATUS_STYLES: Record<OpportunityCellStatus, string> = {
  planned_core: "bg-emerald-900/30 text-emerald-300",
  planned_support: "bg-amber-900/25 text-amber-300",
  planned_development: "bg-blue-900/25 text-blue-300",
  planned_squad_repair: "bg-purple-900/25 text-purple-300",
  actual_core: "bg-emerald-800/40 text-emerald-200",
  actual_support: "bg-amber-800/30 text-amber-200",
  actual_development: "bg-blue-800/30 text-blue-200",
  actual_helper: "bg-cyan-900/25 text-cyan-300",
  actual_unplanned: "bg-orange-900/25 text-orange-300",
  missed_planned_opportunity: "bg-red-900/25 text-red-300",
  unavailable: "bg-zinc-800/50 text-zinc-500",
  not_selected: "bg-zinc-900/30 text-zinc-600",
  blocked: "bg-red-800/30 text-red-200",
  report_missing: "bg-yellow-900/25 text-yellow-300",
};

const ATTENTION_FLAG_LABELS: Record<string, string> = {
  no_actual_opportunity: "No match opportunity in selected horizon",
  high_recent_load: "High recent participation",
  planned_but_absent: "Planned but absent",
  report_missing: "Missing post-match report",
  low_period_participation: "Low participation this period",
};

type TeamFilter = "all" | string;
type AttentionFilter = "all" | "no_opportunity" | "high_load" | "planned_absent" | "report_missing";

export function OpportunityMatrixClient({
  leagueSeasons,
  activeLeagueSeasonId,
  teams,
}: OpportunityMatrixClientProps) {
  const [selectedPeriodId, setSelectedPeriodId] = useState(
    activeLeagueSeasonId ?? leagueSeasons[0]?.id ?? "",
  );
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("all");
  const [attentionFilter, setAttentionFilter] = useState<AttentionFilter>("all");
  const [includeRemoved, setIncludeRemoved] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [matrix, setMatrix] = useState<OpportunityMatrixRow[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!selectedPeriodId) return;
    startTransition(async () => {
      const params = new URLSearchParams({
        leagueSeasonId: selectedPeriodId,
        scope: "full_year",
        context: "league",
        includeRemoved: String(includeRemoved),
        includeInactive: String(includeInactive),
      });
      if (teamFilter !== "all") {
        params.set("teamId", teamFilter);
      }
      const res = await fetch(`/api/insights/opportunity?${params}`);
      if (res.ok) {
        const data = await res.json();
        setMatrix(data.matrix ?? []);
      }
    });
  }, [selectedPeriodId, teamFilter, includeRemoved, includeInactive]);

  const filteredRows = (matrix ?? []).filter((row) => {
    if (attentionFilter === "all") return true;
    if (attentionFilter === "no_opportunity")
      return row.attentionFlags.includes("no_actual_opportunity");
    if (attentionFilter === "high_load")
      return row.attentionFlags.includes("high_recent_load");
    if (attentionFilter === "planned_absent")
      return row.attentionFlags.includes("planned_but_absent");
    if (attentionFilter === "report_missing")
      return row.attentionFlags.includes("report_missing");
    return true;
  });

  const rounds = matrix?.[0]?.cells?.map((c) => ({
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
            <Table2 className="h-5 w-5" />
            Opportunity Matrix
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Player participation by round — who gets match opportunities, who doesn&apos;t, and why
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {leagueSeasons.length > 1 && (
          <div className="flex items-center gap-2">
            <label htmlFor="period-select" className="text-xs text-zinc-500">
              League season
            </label>
            <select
              id="period-select"
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
          <label htmlFor="team-filter" className="text-xs text-zinc-500">
            Team
          </label>
          <select
            id="team-filter"
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
          <label htmlFor="attention-filter" className="text-xs text-zinc-500">
            Attention
          </label>
          <select
            id="attention-filter"
            value={attentionFilter}
            onChange={(e) => setAttentionFilter(e.target.value as AttentionFilter)}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200"
          >
            <option value="all">All players</option>
            <option value="no_opportunity">No match opportunity</option>
            <option value="high_load">High recent load</option>
            <option value="planned_absent">Planned but absent</option>
            <option value="report_missing">Missing report</option>
          </select>
        </div>

        <label className="flex items-center gap-1.5 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={includeRemoved}
            onChange={(e) => setIncludeRemoved(e.target.checked)}
            className="rounded border-zinc-600 bg-zinc-900"
          />
          Include removed
        </label>

        <label className="flex items-center gap-1.5 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="rounded border-zinc-600 bg-zinc-900"
          />
          Include inactive
        </label>
      </div>

      <div className="flex flex-wrap gap-3 text-[10px]">
        {Object.entries(STATUS_STYLES).map(([status, style]) => (
          <span key={status} className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${style}`}>
            {STATUS_LABELS[status as OpportunityCellStatus]}
          </span>
        ))}
      </div>

      {isPending && !matrix && (
        <p className="text-sm text-zinc-500">Loading matrix...</p>
      )}

      {matrix && matrix.length === 0 && (
        <p className="text-sm text-zinc-500">
          No players found for the selected filters.
        </p>
      )}

      {matrix && matrix.length > 0 && (
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
                  Core
                </th>
                <th className="px-2 py-2 text-center text-[11px] font-medium text-zinc-400">
                  Sup
                </th>
                <th className="px-2 py-2 text-center text-[11px] font-medium text-zinc-400">
                  Dev
                </th>
                <th className="px-2 py-2 text-center text-[11px] font-medium text-zinc-400">
                  Actual
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
                          STATUS_STYLES[cell.status] ?? "bg-zinc-800 text-zinc-400"
                        }`}
                        title={`${STATUS_LABELS[cell.status]}${cell.role ? ` (${cell.role})` : ""}${cell.explanation ? ` — ${cell.explanation}` : ""}`}
                      >
                        {STATUS_LABELS[cell.status]}
                      </span>
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-center text-xs text-zinc-300">
                    {row.totals.coreAppearances}
                  </td>
                  <td className="px-2 py-1.5 text-center text-xs text-zinc-300">
                    {row.totals.supportAppearances}
                  </td>
                  <td className="px-2 py-1.5 text-center text-xs text-zinc-300">
                    {row.totals.developmentAppearances}
                  </td>
                  <td className="px-2 py-1.5 text-center text-xs text-zinc-300">
                    {row.totals.actualAppearances}
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