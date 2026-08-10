"use client";

import { useState, useEffect, useTransition } from "react";
import type { PathwayCellStatus, PlayerPathwayRow } from "@/lib/pathways/pathways-types";

interface LeagueSeasonOption {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

interface TeamOption {
  id: string;
  name: string;
}

type ViewMode = "finalized_only" | "include_drafts";
type FilterMode = "all" | "by_core_team" | "high_support" | "low_development" | "dropped_recently";

const CELL_STATUS_LABELS: Record<PathwayCellStatus, string> = {
  core_home: "Core",
  support_sent: "Support",
  development_moved: "Dev",
  squad_repair_received: "Repair",
  core_match_drop: "Dropped",
  not_selected: "—",
  unavailable: "Unav",
  cancelled: "Canx",
  draft_core: "Core*",
  draft_support: "Sup*",
  draft_development: "Dev*",
  draft_squad_repair: "Rep*",
  draft_core_match_drop: "Drop*",
  no_data: "—",
};

const CELL_STATUS_STYLES: Record<PathwayCellStatus, string> = {
  core_home: "bg-emerald-900/60 text-emerald-200",
  support_sent: "bg-amber-900/60 text-amber-200",
  development_moved: "bg-blue-900/60 text-blue-200",
  squad_repair_received: "bg-purple-900/60 text-purple-200",
  core_match_drop: "bg-rose-900/60 text-rose-200",
  not_selected: "bg-zinc-800 text-zinc-500",
  unavailable: "bg-zinc-800 text-zinc-600 line-through",
  cancelled: "bg-zinc-800 text-zinc-600",
  draft_core: "bg-emerald-950/40 text-emerald-300/70 border border-emerald-700/30",
  draft_support: "bg-amber-950/40 text-amber-300/70 border border-amber-700/30",
  draft_development: "bg-blue-950/40 text-blue-300/70 border border-blue-700/30",
  draft_squad_repair: "bg-purple-950/40 text-purple-300/70 border border-purple-700/30",
  draft_core_match_drop: "bg-rose-950/40 text-rose-300/70 border border-rose-700/30",
  no_data: "bg-zinc-900 text-zinc-600",
};



interface PlayerPathwaysClientProps {
  leagueSeasons: LeagueSeasonOption[];
  activeLeagueSeasonId: string | null;
  teams: TeamOption[];
}

interface PathwayData {
  leagueSeasonId: string;
  leagueSeasonName: string;
  roundCount: number;
  finalizedRoundCount: number;
  draftRoundCount: number;
  summary: {
    playersShown: number;
    temporarySupportAppearances: number;
    playersWithNoCompletedOpportunity: number;
    playersInMultipleContexts: number;
    mostFrequentHelpers: Array<{ playerId: string; playerName: string; supportCount: number }>;
  };
  players: PlayerPathwayRow[];
  rounds: Array<{ matchRoundId: string; matchRoundName: string; isFinalized: boolean }>;
}

export function PlayerPathwaysClient({
  leagueSeasons,
  activeLeagueSeasonId,
  teams,
}: PlayerPathwaysClientProps) {
  const [selectedPeriodId, setSelectedPeriodId] = useState(activeLeagueSeasonId ?? "");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("finalized_only");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [data, setData] = useState<PathwayData | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedPeriodId) return;
    const controller = new AbortController();

    startTransition(async () => {
      try {
        const params = new URLSearchParams({
          leagueSeasonId: selectedPeriodId,
          scope: "full_year",
          context: "league",
          viewMode,
        });
        if (teamFilter !== "all") params.set("teamId", teamFilter);

        const res = await fetch(`/api/insights/player-pathways?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          setError(errBody?.error ?? `Failed to load pathways (${res.status})`);
          return;
        }
        const body = await res.json();
        setData(body.pathways);
        setError(null);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    });

    return () => controller.abort();
  }, [selectedPeriodId, teamFilter, viewMode]);

  const filteredPlayers = data?.players ?? [];

  const displayPlayers = (() => {
    switch (filterMode) {
      case "high_support":
        return filteredPlayers.filter((p) => p.supportAppearances > 0).sort((a, b) => b.supportAppearances - a.supportAppearances);
      case "low_development":
        return filteredPlayers.filter((p) => p.developmentAppearances === 0 && p.coreAppearances > 0);
      case "dropped_recently":
        return filteredPlayers.filter((p) => p.droppedRounds > 0).sort((a, b) => b.droppedRounds - a.droppedRounds);
      case "by_core_team":
        return teamFilter !== "all"
          ? filteredPlayers
          : filteredPlayers.sort((a, b) => a.coreTeamName.localeCompare(b.coreTeamName));
      default:
        return filteredPlayers;
    }
  })();

  const rounds = data?.rounds ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Player Pathways</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Track load, movement, and context across the league season.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedPeriodId}
          onChange={(e) => setSelectedPeriodId(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 text-zinc-200 rounded px-3 py-1.5 text-sm"
          aria-label="League season"
        >
          {leagueSeasons.map((ls) => (
            <option key={ls.id} value={ls.id}>
              {ls.name}
            </option>
          ))}
        </select>

        <select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 text-zinc-200 rounded px-3 py-1.5 text-sm"
          aria-label="Team filter"
        >
          <option value="all">All teams</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <select
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value as ViewMode)}
          className="bg-zinc-800 border border-zinc-700 text-zinc-200 rounded px-3 py-1.5 text-sm"
          aria-label="View mode"
        >
          <option value="finalized_only">Finalized only</option>
          <option value="include_drafts">Include drafts</option>
        </select>

        <select
          value={filterMode}
          onChange={(e) => setFilterMode(e.target.value as FilterMode)}
          className="bg-zinc-800 border border-zinc-700 text-zinc-200 rounded px-3 py-1.5 text-sm"
          aria-label="Filter"
        >
          <option value="all">All players</option>
          <option value="high_support">High support burden</option>
          <option value="low_development">No development exposure</option>
          <option value="dropped_recently">Dropped recently</option>
          <option value="by_core_team">By core team</option>
        </select>
      </div>

      {/* Summary metrics */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50">
            <div className="text-xs text-zinc-400">Players shown</div>
            <div className="text-lg font-semibold text-zinc-100">{data.summary.playersShown}</div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50">
            <div className="text-xs text-zinc-400">Support appearances</div>
            <div className="text-lg font-semibold text-amber-300">{data.summary.temporarySupportAppearances}</div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50">
            <div className="text-xs text-zinc-400">No completed opportunity</div>
            <div className="text-lg font-semibold text-zinc-100">{data.summary.playersWithNoCompletedOpportunity}</div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50">
            <div className="text-xs text-zinc-400">Multiple contexts</div>
            <div className="text-lg font-semibold text-zinc-100">{data.summary.playersInMultipleContexts}</div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50">
            <div className="text-xs text-zinc-400">Most frequent helpers</div>
            <div className="text-sm text-zinc-200">
              {data.summary.mostFrequentHelpers.slice(0, 3).map((h) => h.playerName).join(", ") || "—"}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries(CELL_STATUS_STYLES)
          .filter(([key]) => ["core_home", "support_sent", "development_moved", "squad_repair_received", "core_match_drop", "not_selected", "unavailable", "draft_core"].includes(key))
          .map(([key, style]) => (
            <span key={key} className={`inline-flex items-center px-2 py-0.5 rounded ${style}`}>
              {CELL_STATUS_LABELS[key as PathwayCellStatus]}
            </span>
          ))}
      </div>

      {/* Matrix */}
      {isPending && !data ? (
        <div className="text-zinc-400 text-sm py-8 text-center">Loading pathways...</div>
      ) : error ? (
        <div className="text-red-400 text-sm py-8 text-center">{error}</div>
      ) : !data || displayPlayers.length === 0 ? (
        <div className="text-zinc-400 text-sm py-8 text-center">
          {data ? "No players match the current filters." : "Select a league season to view pathways."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="sticky left-0 z-10 bg-zinc-900 px-2 py-1.5 text-left text-zinc-400 font-medium min-w-[140px]">Player</th>
                <th className="sticky left-[140px] z-10 bg-zinc-900 px-2 py-1.5 text-left text-zinc-400 font-medium min-w-[80px]">Team</th>
                <th className="px-2 py-1.5 text-right text-zinc-400 font-medium min-w-[40px]" title="Core matches">Core</th>
                <th className="px-2 py-1.5 text-right text-zinc-400 font-medium min-w-[40px]" title="Support appearances">Sup</th>
                <th className="px-2 py-1.5 text-right text-zinc-400 font-medium min-w-[40px]" title="Development appearances">Dev</th>
                <th className="px-2 py-1.5 text-right text-zinc-400 font-medium min-w-[40px]" title="Squad repair appearances">Rep</th>
                {rounds.map((r) => (
                  <th key={r.matchRoundId} className="px-2 py-1.5 text-center text-zinc-400 font-medium min-w-[36px]">
                    <span title={r.isFinalized ? r.matchRoundName : `${r.matchRoundName} (draft)`}>
                      {r.matchRoundName.replace("Round ", "R")}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayPlayers.map((player) => (
                <tr key={player.playerId} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="sticky left-0 z-10 bg-zinc-900 px-2 py-1 text-zinc-200 font-medium truncate max-w-[140px]" title={player.playerName}>
                    {player.playerName}
                  </td>
                  <td className="sticky left-[140px] z-10 bg-zinc-900 px-2 py-1 text-zinc-400 truncate max-w-[80px]" title={player.coreTeamName}>
                    {player.coreTeamName}
                  </td>
                  <td className="px-2 py-1 text-right text-zinc-300">{player.coreAppearances}</td>
                  <td className="px-2 py-1 text-right text-amber-300">{player.supportAppearances || "—"}</td>
                  <td className="px-2 py-1 text-right text-blue-300">{player.developmentAppearances || "—"}</td>
                  <td className="px-2 py-1 text-right text-purple-300">{player.squadRepairAppearances || "—"}</td>
                  {rounds.map((r) => {
                    const cell = player.cells.find((c) => c.matchRoundId === r.matchRoundId);
                    if (!cell || cell.status === "no_data") {
                      return (
                        <td key={r.matchRoundId} className="px-1 py-1 text-center">
                          <span className="inline-block w-full text-zinc-600">—</span>
                        </td>
                      );
                    }
                    return (
                      <td key={r.matchRoundId} className="px-1 py-1 text-center" title={`${CELL_STATUS_LABELS[cell.status]} · ${cell.teamName}${cell.opponent ? ` vs ${cell.opponent}` : ""}`}>
                        <span className={`inline-flex items-center justify-center w-full rounded px-0.5 py-0.5 text-[10px] font-medium ${CELL_STATUS_STYLES[cell.status]}`}>
                          {CELL_STATUS_LABELS[cell.status]}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}