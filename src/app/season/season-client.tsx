"use client";

import { useState, useTransition, useEffect } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, X } from "lucide-react";
import {
  type PlayerRowSummary,
  type SeasonPlayerRoundMatrix,
  type MovementPathRow,
  type MovementTimelineEntry,
} from "@/lib/selection/get-season-overview";

type PlanningPeriodOption = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
};

type SeasonClientProps = {
  planningPeriods: PlanningPeriodOption[];
  activePlanningPeriodId: string | null;
};

type FilterState =
  | "all"
  | "by_core_team"
  | "high_load"
  | "low_load"
  | "high_support"
  | "low_development"
  | "double_load"
  | "dropped_recently"
  | "unavailable_heavy";

type SortState =
  | "name"
  | "core_team"
  | "total_matches"
  | "support_count"
  | "development_count"
  | "double_load_count"
  | "drops"
  | "warnings";

const ROLE_CELL_STYLES: Record<string, string> = {
  CORE: "bg-emerald-900/30 text-emerald-300 border-emerald-700/30",
  SUPPORT: "bg-amber-900/25 text-amber-300 border-amber-700/30",
  DEVELOPMENT: "bg-blue-900/25 text-blue-300 border-blue-700/30",
  BACKFILL: "bg-purple-900/25 text-purple-300 border-purple-700/30",
  DOUBLE_LOAD: "bg-red-900/25 text-red-300 border-red-700/30",
  CORE_MATCH_DROP: "bg-zinc-800/30 text-zinc-400 border-zinc-600/30",
  REDUCED_MATCH_LOAD_DROP: "bg-zinc-800/30 text-zinc-400 border-zinc-600/30",
};

const ROLE_LABELS: Record<string, string> = {
  CORE: "Core",
  SUPPORT: "Sup",
  DEVELOPMENT: "Dev",
  BACKFILL: "Rep",
  DOUBLE_LOAD: "2x",
  CORE_MATCH_DROP: "Drp",
  REDUCED_MATCH_LOAD_DROP: "Drp",
};

export function SeasonOverviewClient({
  planningPeriods,
  activePlanningPeriodId,
}: SeasonClientProps) {
  const [selectedPeriodId, setSelectedPeriodId] = useState(
    activePlanningPeriodId ?? planningPeriods[0]?.id ?? "",
  );
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [filter, setFilter] = useState<FilterState>("all");
  const [sort, setSort] = useState<SortState>("name");
  const [matrix, setMatrix] = useState<SeasonPlayerRoundMatrix | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [playerTimeline, setPlayerTimeline] = useState<
    MovementTimelineEntry[] | null
  >(null);
  const [movementPaths, setMovementPaths] = useState<MovementPathRow[]>([]);
  const [selectedPathKey, setSelectedPathKey] = useState<string | null>(null);
  const [pathPlayers, setPathPlayers] = useState<
    Array<{ playerName: string; roundName: string; date: string }>
  >([]);

  useEffect(() => {
    if (!selectedPeriodId) return;
    startTransition(async () => {
      const res = await fetch(
        `/api/season/matrix?planningPeriodId=${selectedPeriodId}&includeDrafts=${includeDrafts}`,
      );
      if (res.ok) {
        const data = await res.json();
        setMatrix(data);
      }
    });
  }, [selectedPeriodId, includeDrafts]);

  useEffect(() => {
    if (!selectedPeriodId) return;
    startTransition(async () => {
      const res = await fetch(
        `/api/season/movement-paths?planningPeriodId=${selectedPeriodId}&includeDrafts=${includeDrafts}`,
      );
      if (res.ok) {
        const data = await res.json();
        setMovementPaths(data);
      }
    });
  }, [selectedPeriodId, includeDrafts]);

  useEffect(() => {
    if (!selectedPlayerId) {
      setPlayerTimeline(null);
      return;
    }
    startTransition(async () => {
      const res = await fetch(
        `/api/season/player-timeline?playerId=${selectedPlayerId}&includeDrafts=${includeDrafts}&planningPeriodId=${selectedPeriodId}`,
      );
      if (res.ok) {
        const data = await res.json();
        setPlayerTimeline(data);
      }
    });
  }, [selectedPlayerId, includeDrafts]);

  const filteredPlayers = applyFilter(matrix?.players ?? [], filter);
  const sortedPlayers = applySort(filteredPlayers, sort);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select
          className="h-8 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2 text-sm text-zinc-100"
          value={selectedPeriodId}
          onChange={(e) => setSelectedPeriodId(e.target.value)}
        >
          {planningPeriods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <button
          className={`h-8 rounded-lg px-3 text-xs font-medium transition-colors ${
            !includeDrafts
              ? "border border-[var(--accent)]/30 bg-[var(--accent-subtle)] text-zinc-100"
              : "border border-[var(--border-soft)] bg-[var(--surface-muted)] text-[var(--text-soft)]"
          }`}
          onClick={() => setIncludeDrafts(false)}
          type="button"
        >
          Finalized only
        </button>
        <button
          className={`h-8 rounded-lg px-3 text-xs font-medium transition-colors ${
            includeDrafts
              ? "border border-[var(--accent)]/30 bg-[var(--accent-subtle)] text-zinc-100"
              : "border border-[var(--border-soft)] bg-[var(--surface-muted)] text-[var(--text-soft)]"
          }`}
          onClick={() => setIncludeDrafts(true)}
          type="button"
        >
          Include drafts
        </button>

        <select
          className="h-8 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2 text-xs text-zinc-100"
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterState)}
        >
          <option value="all">All players</option>
          <option value="by_core_team">By core team</option>
          <option value="high_load">High load</option>
          <option value="low_load">Low load</option>
          <option value="high_support">High support burden</option>
          <option value="low_development">Low development exposure</option>
          <option value="double_load">Double-load used</option>
          <option value="dropped_recently">Dropped recently</option>
          <option value="unavailable_heavy">Unavailable-heavy</option>
        </select>

        <select
          className="h-8 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2 text-xs text-zinc-100"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortState)}
        >
          <option value="name">Sort: Player name</option>
          <option value="core_team">Sort: Core team</option>
          <option value="total_matches">Sort: Total matches</option>
          <option value="support_count">Sort: Support count</option>
          <option value="development_count">Sort: Development count</option>
          <option value="double_load_count">Sort: Double-load</option>
          <option value="drops">Sort: Drops</option>
          <option value="warnings">Sort: Warnings</option>
        </select>
      </div>

      {matrix && (
        <div className="flex items-center gap-4 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] px-4 py-3 text-xs">
          <span className="text-zinc-300">
            <span className="font-semibold text-zinc-100">
              {matrix.roundCount}
            </span>{" "}
            rounds
          </span>
          <span className="text-zinc-300">
            <span className="font-semibold text-emerald-400">
              {matrix.finalizedRoundCount}
            </span>{" "}
            finalized
          </span>
          <span className="text-zinc-300">
            <span className="font-semibold text-amber-400">
              {matrix.draftRoundCount}
            </span>{" "}
            draft
          </span>
          <span className="text-zinc-300">
            <span className="font-semibold text-red-400">
              {matrix.playersWithWarnings}
            </span>{" "}
            w/ warnings
          </span>
          {matrix.highestSupportBurden && (
            <span className="text-zinc-300">
              Highest support:{" "}
              <span className="font-semibold text-amber-300">
                {matrix.highestSupportBurden}
              </span>
            </span>
          )}
          {matrix.doubleLoadCount > 0 && (
            <span className="text-zinc-300">
              <span className="font-semibold text-red-400">
                {matrix.doubleLoadCount}
              </span>{" "}
              player{matrix.doubleLoadCount !== 1 ? "s" : ""} w/ double-load
            </span>
          )}
        </div>
      )}

      {isPending && (
        <p className="text-xs text-[var(--text-muted)]">Loading...</p>
      )}

      {matrix && sortedPlayers.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)]">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-[var(--border-soft)]">
                <th className="sticky left-0 z-10 bg-[var(--surface-base)] px-2 py-2 text-left text-[10px] font-semibold text-zinc-300 whitespace-nowrap">
                  Player
                </th>
                <th className="px-2 py-2 text-left text-[10px] font-semibold text-zinc-300 whitespace-nowrap">
                  Team
                </th>
                {matrix.rounds.map((r) => (
                  <th
                    key={r.matchRoundId}
                    className="px-1 py-2 text-center text-[9px] font-semibold text-zinc-400 whitespace-nowrap"
                  >
                    {r.matchRoundName}
                  </th>
                ))}
                <th className="px-2 py-2 text-center text-[9px] font-semibold text-zinc-300 whitespace-nowrap border-l app-hairline">
                  Total
                </th>
                <th className="px-2 py-2 text-center text-[9px] font-semibold text-zinc-300 whitespace-nowrap">
                  Core
                </th>
                <th className="px-2 py-2 text-center text-[9px] font-semibold text-zinc-300 whitespace-nowrap">
                  Sup
                </th>
                <th className="px-2 py-2 text-center text-[9px] font-semibold text-zinc-300 whitespace-nowrap">
                  Dev
                </th>
                <th className="px-2 py-2 text-center text-[9px] font-semibold text-zinc-300 whitespace-nowrap">
                  Rep
                </th>
                <th className="px-2 py-2 text-center text-[9px] font-semibold text-zinc-300 whitespace-nowrap">
                  2x
                </th>
                <th className="px-2 py-2 text-center text-[9px] font-semibold text-zinc-300 whitespace-nowrap">
                  Drp
                </th>
                <th className="px-2 py-2 text-center text-[9px] font-semibold text-zinc-300 whitespace-nowrap">
                  Unav
                </th>
                <th className="px-2 py-2 text-center text-[9px] font-semibold text-zinc-300 whitespace-nowrap">
                  Warn
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((player) => (
                <tr
                  key={player.playerId}
                  className={`border-b border-[var(--border-soft)] hover:bg-[var(--surface-hover)] cursor-pointer ${
                    selectedPlayerId === player.playerId
                      ? "bg-[var(--accent-subtle)]"
                      : ""
                  }`}
                  onClick={() =>
                    setSelectedPlayerId(
                      selectedPlayerId === player.playerId
                        ? null
                        : player.playerId,
                    )
                  }
                >
                  <td className="sticky left-0 z-10 bg-inherit px-2 py-1.5 text-zinc-100 whitespace-nowrap font-medium">
                    {player.playerName}
                  </td>
                  <td className="px-2 py-1.5 text-zinc-300 whitespace-nowrap">
                    {player.coreTeamName}
                  </td>
                  {matrix.rounds.map((round) => {
                    const roundCells = player.cells.filter(
                      (c) => c.matchRoundId === round.matchRoundId,
                    );
                    if (roundCells.length === 0) {
                      const isUnavailable =
                        player.unavailableRounds > 0;
                      return (
                        <td
                          key={round.matchRoundId}
                          className="px-1 py-1.5 text-center"
                        >
                          {isUnavailable ? (
                            <span className="text-[9px] text-zinc-500">
                              Unav
                            </span>
                          ) : (
                            <span className="text-[9px] text-zinc-600">—</span>
                          )}
                        </td>
                      );
                    }
                    return (
                      <td
                        key={round.matchRoundId}
                        className="px-1 py-1.5 text-center"
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          {roundCells.map((cell, ci) => {
                            const isDraft = cell.status === "DRAFT";
                            const style =
                              ROLE_CELL_STYLES[cell.role] ??
                              "bg-zinc-800/20 text-zinc-400 border-zinc-600/30";
                            const label =
                              ROLE_LABELS[cell.role] ?? cell.role.slice(0, 3);
                            return (
                              <span
                                key={ci}
                                className={`inline-flex items-center justify-center rounded px-1 py-0.5 text-[9px] font-semibold border ${style} ${isDraft ? "opacity-60 border-dashed" : ""}`}
                                title={`${cell.role} for ${cell.teamName}${isDraft ? " (draft)" : ""}`}
                              >
                                {label}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 text-center text-zinc-200 font-semibold border-l app-hairline">
                    {player.totalMatches}
                  </td>
                  <td className="px-2 py-1.5 text-center text-emerald-400">
                    {player.coreMatches}
                  </td>
                  <td className="px-2 py-1.5 text-center text-amber-400">
                    {player.supportMatches}
                  </td>
                  <td className="px-2 py-1.5 text-center text-blue-400">
                    {player.developmentMatches}
                  </td>
                  <td className="px-2 py-1.5 text-center text-purple-400">
                    {player.backfillMatches}
                  </td>
                  <td className="px-2 py-1.5 text-center text-red-400">
                    {player.doubleLoadRounds}
                  </td>
                  <td className="px-2 py-1.5 text-center text-zinc-400">
                    {player.droppedRounds}
                  </td>
                  <td className="px-2 py-1.5 text-center text-zinc-500">
                    {player.unavailableRounds}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {player.warningCount > 0 ? (
                      <span className="inline-flex items-center gap-0.5 text-amber-400">
                        <AlertTriangle className="h-3 w-3" />
                        {player.warningCount}
                      </span>
                    ) : (
                      <span className="text-zinc-600">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedPlayerId && playerTimeline && (
        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-zinc-100">
              Player movement timeline
            </h3>
            <button
              onClick={() => {
                setSelectedPlayerId(null);
                setPlayerTimeline(null);
              }}
              className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] transition-colors"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {playerTimeline.map((entry, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 text-zinc-500" />}
                <span
                  className={`rounded border px-1.5 py-0.5 ${
                    entry.status === "DRAFT"
                      ? "border-dashed opacity-60"
                      : ""
                  } ${
                    ROLE_CELL_STYLES[entry.role] ??
                    "bg-zinc-800/20 text-zinc-400 border-zinc-600/30"
                  }`}
                >
                  {entry.matchRoundName} {entry.teamName?.slice(0, 3)}{" "}
                  {ROLE_LABELS[entry.role] ?? entry.role.slice(0, 3)}
                  {entry.status === "DRAFT" && (
                    <span className="text-zinc-500 ml-0.5">draft</span>
                  )}
                </span>
                {entry.fromTeamName && (
                  <span className="text-[9px] text-zinc-400">
                    {entry.fromTeamName.slice(0, 3)}→
                    {entry.teamName?.slice(0, 3)}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {movementPaths.length > 0 && (
        <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] p-4">
          <h3 className="text-sm font-semibold text-zinc-100 mb-3">
            Movement path summary
          </h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border-soft)]">
                <th className="text-left py-1.5 pr-3 text-[10px] font-semibold text-zinc-400">
                  From
                </th>
                <th className="text-left py-1.5 pr-3 text-[10px] font-semibold text-zinc-400">
                  To
                </th>
                <th className="text-left py-1.5 pr-3 text-[10px] font-semibold text-zinc-400">
                  Role
                </th>
                <th className="text-center py-1.5 pr-3 text-[10px] font-semibold text-zinc-400">
                  Count
                </th>
                <th className="text-center py-1.5 pr-3 text-[10px] font-semibold text-zinc-400">
                  Players
                </th>
              </tr>
            </thead>
            <tbody>
              {movementPaths.map((path) => {
                const key = `${path.fromTeamId}:${path.toTeamId}:${path.role}`;
                const isSelected = selectedPathKey === key;
                return (
                  <tr
                    key={key}
                    className={`border-b border-[var(--border-soft)] cursor-pointer hover:bg-[var(--surface-hover)] ${
                      isSelected ? "bg-[var(--accent-subtle)]" : ""
                    }`}
                    onClick={() => {
                      if (selectedPathKey === key) {
                        setSelectedPathKey(null);
                        setPathPlayers([]);
                      } else {
                        setSelectedPathKey(key);
                        fetch(
                          `/api/season/path-detail?fromTeamId=${path.fromTeamId}&toTeamId=${path.toTeamId}&role=${path.role}&planningPeriodId=${selectedPeriodId}&includeDrafts=${includeDrafts}`,
                        )
                          .then((r) => r.json())
                          .then((data) => setPathPlayers(data));
                      }
                    }}
                  >
                    <td className="py-1.5 pr-3 text-zinc-200">
                      {path.fromTeamName}
                    </td>
                    <td className="py-1.5 pr-3 text-zinc-200">
                      {path.toTeamName}
                    </td>
                    <td className="py-1.5 pr-3">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          ROLE_CELL_STYLES[path.role] ??
                          "bg-zinc-800/20 text-zinc-400"
                        }`}
                      >
                        {path.role}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 text-center text-zinc-200">
                      {path.count}
                    </td>
                    <td className="py-1.5 pr-3 text-center text-zinc-300">
                      {path.uniquePlayers}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {selectedPathKey && pathPlayers.length > 0 && (
            <div className="mt-3 border-t border-[var(--border-soft)] pt-3">
              <h4 className="text-[11px] font-semibold text-zinc-300 mb-2">
                Path detail
              </h4>
              <div className="flex flex-wrap gap-2 text-xs">
                {pathPlayers.map((p, i) => (
                  <span
                    key={i}
                    className="rounded border border-[var(--border-soft)] px-2 py-1 text-zinc-200"
                  >
                    {p.playerName} · {p.roundName} · {p.date}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function applyFilter(
  players: PlayerRowSummary[],
  filter: FilterState,
): PlayerRowSummary[] {
  switch (filter) {
    case "high_load":
      return players.filter((p) => p.totalMatches > 0).sort((a, b) => b.totalMatches - a.totalMatches);
    case "low_load":
      return players.filter((p) => p.totalMatches <= 2);
    case "high_support":
      return players.filter((p) => p.supportMatches > p.coreMatches);
    case "low_development":
      return players.filter((p) => p.developmentMatches === 0 && p.supportMatches > 0);
    case "double_load":
      return players.filter((p) => p.doubleLoadRounds > 0);
    case "dropped_recently":
      return players.filter((p) => p.droppedRounds > 0);
    case "unavailable_heavy":
      return players.filter((p) => p.unavailableRounds > 1);
    case "by_core_team":
      return [...players].sort((a, b) =>
        a.coreTeamName.localeCompare(b.coreTeamName),
      );
    default:
      return players;
  }
}

function applySort(
  players: PlayerRowSummary[],
  sort: SortState,
): PlayerRowSummary[] {
  const sorted = [...players];
  switch (sort) {
    case "name":
      return sorted.sort((a, b) => a.playerName.localeCompare(b.playerName));
    case "core_team":
      return sorted.sort((a, b) =>
        a.coreTeamName.localeCompare(b.coreTeamName),
      );
    case "total_matches":
      return sorted.sort((a, b) => b.totalMatches - a.totalMatches);
    case "support_count":
      return sorted.sort((a, b) => b.supportMatches - a.supportMatches);
    case "development_count":
      return sorted.sort((a, b) => b.developmentMatches - a.developmentMatches);
    case "double_load_count":
      return sorted.sort((a, b) => b.doubleLoadRounds - a.doubleLoadRounds);
    case "drops":
      return sorted.sort((a, b) => b.droppedRounds - a.droppedRounds);
    case "warnings":
      return sorted.sort((a, b) => b.warningCount - a.warningCount);
    default:
      return sorted;
  }
}