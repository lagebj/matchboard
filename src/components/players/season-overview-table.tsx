"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { PlayerSeasonOverviewRow } from "@/lib/players/get-players-overview";

type SeasonOverviewTableProps = {
  rows: PlayerSeasonOverviewRow[];
  planningPeriodLabel: string;
  reportedMatchCount: number;
  totalActualAppearances: number;
  totalMatchdayAdditions: number;
  totalRounds: number;
  finalisedRounds: number;
  draftRounds: number;
  teams: Array<{ id: string; name: string }>;
};

type SortField =
  | "displayName"
  | "coreTeam"
  | "actualAppearances"
  | "goals"
  | "assists"
  | "coreAppearances"
  | "supportAppearances"
  | "developmentAppearances"
  | "squadRepairAppearances"
  | "matchdayAdditions"
  | "plannedButAbsent"
  | "draftSelections"
  | "unavailableRoundCount";

type SortDirection = "asc" | "desc";

type MovementFilter = "all" | "has_support" | "has_development" | "has_matchday_additions" | "has_squad_repair";
type AttendanceFilter = "all" | "has_planned_absent";
type LoadFilter = "all" | "low_load" | "high_load";

export function SeasonOverviewTable({
  rows,
  planningPeriodLabel,
  reportedMatchCount,
  totalActualAppearances,
  totalMatchdayAdditions,
  totalRounds,
  finalisedRounds,
  draftRounds,
  teams,
}: SeasonOverviewTableProps) {
  const [sortField, setSortField] = useState<SortField>("actualAppearances");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [movementFilter, setMovementFilter] = useState<MovementFilter>("all");
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceFilter>("all");
  const [loadFilter, setLoadFilter] = useState<LoadFilter>("all");
  const [search, setSearch] = useState("");
  const [includeDrafts, setIncludeDrafts] = useState(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "displayName" || field === "coreTeam" ? "asc" : "asc");
    }
  };

  const filteredRows = useMemo(() => {
    let result = rows;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) => r.displayName.toLowerCase().includes(q));
    }

    if (teamFilter !== "all") {
      result = result.filter((r) => r.coreTeam?.id === teamFilter);
    }

    if (movementFilter === "has_support") {
      result = result.filter((r) => r.supportAppearances > 0);
    } else if (movementFilter === "has_development") {
      result = result.filter((r) => r.developmentAppearances > 0);
    } else if (movementFilter === "has_matchday_additions") {
      result = result.filter((r) => r.matchdayAdditions > 0);
    } else if (movementFilter === "has_squad_repair") {
      result = result.filter((r) => r.squadRepairAppearances > 0);
    }

    if (attendanceFilter === "has_planned_absent") {
      result = result.filter((r) => r.plannedButAbsent > 0);
    }

    if (loadFilter === "low_load") {
      result = result.filter((r) => r.actualAppearances <= 1);
    } else if (loadFilter === "high_load") {
      const avg = rows.reduce((sum, r) => sum + r.actualAppearances, 0) / rows.length;
      result = result.filter((r) => r.actualAppearances > avg);
    }

    if (!includeDrafts) {
      result = result.map((r) => ({
        ...r,
        draftSelections: 0,
        recentInvolvement: r.recentInvolvement.filter((i) => i.state !== "DRAFT"),
      }));
    }

    return [...result].sort((a, b) => {
      let cmp = 0;
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (typeof aVal === "string" && typeof bVal === "string") {
        cmp = aVal.localeCompare(bVal);
      } else if (typeof aVal === "number" && typeof bVal === "number") {
        cmp = aVal - bVal;
      } else {
        cmp = (aVal ?? 0) < (bVal ?? 0) ? -1 : 1;
      }

      if (sortField === "actualAppearances" && cmp === 0) {
        cmp = (a.coreTeam?.name ?? "").localeCompare(b.coreTeam?.name ?? "");
      }
      if ((sortField === "actualAppearances" || sortField === "coreTeam") && cmp === 0) {
        cmp = a.displayName.localeCompare(b.displayName);
      }

      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, search, teamFilter, movementFilter, attendanceFilter, loadFilter, includeDrafts, sortField, sortDir]);

  const playersWithSignals = rows.filter((r) => r.draftSelections > 0 || r.squadRepairAppearances > 0).length;
  const highestSupportBurden = rows.reduce((max, r) => Math.max(max, r.supportAppearances), 0);

  const renderSortHeader = (field: SortField, label: string) => (
    <th
      key={field}
      className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] cursor-pointer hover:text-zinc-300 select-none"
      onClick={() => handleSort(field)}
      aria-sort={sortField === field ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortField === field && (
          <span className="text-[8px]">{sortDir === "asc" ? "↑" : "↓"}</span>
        )}
      </span>
    </th>
  );

  const numCell = (val: number) => val > 0 ? val : "—";

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-zinc-500">
        Actual participation and recorded match statistics for{" "}
        <span className="font-medium text-zinc-400">{planningPeriodLabel}</span>.
        Played, goals and assists use reported match participation. Finalised upcoming matches remain separate until match reporting is completed.
      </p>

      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <span>{rows.length} player{rows.length !== 1 ? "s" : ""}</span>
        <span className="text-zinc-600">·</span>
        <span>{reportedMatchCount} match{reportedMatchCount !== 1 ? "es" : ""} reported</span>
        <span className="text-zinc-600">·</span>
        <span>{totalActualAppearances} appearance{totalActualAppearances !== 1 ? "s" : ""} recorded</span>
        {totalMatchdayAdditions > 0 && (
          <>
            <span className="text-zinc-600">·</span>
            <span>{totalMatchdayAdditions} matchday addition{totalMatchdayAdditions !== 1 ? "s" : ""}</span>
          </>
        )}
        <span className="text-zinc-600">·</span>
        <span>{finalisedRounds}/{totalRounds} rounds finalised{draftRounds > 0 ? ` (${draftRounds} draft)` : ""}</span>
        {playersWithSignals > 0 && (
          <>
            <span className="text-zinc-600">·</span>
            <span>{playersWithSignals} player{playersWithSignals !== 1 ? "s" : ""} with draft or squad repair</span>
          </>
        )}
        {highestSupportBurden > 0 && (
          <>
            <span className="text-zinc-600">·</span>
            <span>highest support: {highestSupportBurden}</span>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="Search players..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[var(--accent-strong)]"
          aria-label="Search players"
        />
        <select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          className="h-8 rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-[var(--accent-strong)]"
          aria-label="Filter by team"
        >
          <option value="all">All teams</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select
          value={movementFilter}
          onChange={(e) => setMovementFilter(e.target.value as MovementFilter)}
          className="h-8 rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-[var(--accent-strong)]"
          aria-label="Filter by movement"
        >
          <option value="all">All movement</option>
          <option value="has_support">Has support appearances</option>
          <option value="has_development">Has development appearances</option>
          <option value="has_squad_repair">Has squad repair</option>
          <option value="has_matchday_additions">Has matchday additions</option>
        </select>
        <select
          value={loadFilter}
          onChange={(e) => setLoadFilter(e.target.value as LoadFilter)}
          className="h-8 rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-[var(--accent-strong)]"
          aria-label="Filter by load"
        >
          <option value="all">All load</option>
          <option value="low_load">Low load (1 or fewer)</option>
          <option value="high_load">High load (above average)</option>
        </select>
        <select
          value={attendanceFilter}
          onChange={(e) => setAttendanceFilter(e.target.value as AttendanceFilter)}
          className="h-8 rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-[var(--accent-strong)]"
          aria-label="Filter by attendance"
        >
          <option value="all">All attendance</option>
          <option value="has_planned_absent">Has planned absences</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={includeDrafts}
            onChange={(e) => setIncludeDrafts(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-800 text-[var(--accent-strong)] focus:ring-[var(--accent-strong)]"
          />
          Include drafts
        </label>
      </div>

      <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-soft)] bg-[var(--surface-muted)]">
                {renderSortHeader("displayName", "Player")}
                {renderSortHeader("coreTeam", "Core team")}
                {renderSortHeader("actualAppearances", "Played")}
                {renderSortHeader("goals", "Goals")}
                {renderSortHeader("assists", "Assists")}
                {renderSortHeader("coreAppearances", "Core")}
                {renderSortHeader("supportAppearances", "Support")}
                {renderSortHeader("developmentAppearances", "Development")}
                {renderSortHeader("squadRepairAppearances", "Squad repair")}
                {renderSortHeader("matchdayAdditions", "Matchday additions")}
                {renderSortHeader("plannedButAbsent", "Planned absent")}
                {includeDrafts && renderSortHeader("draftSelections", "Draft")}
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Review
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)]">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={includeDrafts ? 13 : 12} className="px-4 py-8 text-center text-sm text-zinc-500">
                    No players match the current filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.playerId} className={`hover:bg-[rgba(255,255,255,0.02)] transition-colors${row.draftSelections > 0 && includeDrafts ? " bg-zinc-900/30" : ""}`}>
                    <td className="px-4 py-2">
                      <Link href={`/players/${row.playerId}`} className="font-medium text-zinc-200 hover:text-zinc-50">
                        {row.displayName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      {row.coreTeam ? (
                        <Link href={`/teams/${row.coreTeam.id}`} className="hover:text-zinc-200">
                          {row.coreTeam.name}
                        </Link>
                      ) : (
                        <span className="text-zinc-500">Unassigned</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-zinc-200 tabular-nums">{row.actualAppearances}</td>
                    <td className="px-3 py-2 text-zinc-300 tabular-nums">{row.goals}</td>
                    <td className="px-3 py-2 text-zinc-300 tabular-nums">{row.assists}</td>
                    <td className="px-3 py-2 text-zinc-300 tabular-nums">{row.coreAppearances}</td>
                    <td className="px-3 py-2 text-zinc-300 tabular-nums">{row.supportAppearances}</td>
                    <td className="px-3 py-2 text-zinc-300 tabular-nums">{row.developmentAppearances}</td>
                    <td className="px-3 py-2 text-zinc-300 tabular-nums">{numCell(row.squadRepairAppearances)}</td>
                    <td className="px-3 py-2 text-zinc-300 tabular-nums">{numCell(row.matchdayAdditions)}</td>
                    <td className="px-3 py-2 text-zinc-300 tabular-nums">{numCell(row.plannedButAbsent)}</td>
                    {includeDrafts && (
                      <td className="px-3 py-2 text-zinc-400 tabular-nums italic">{numCell(row.draftSelections)}</td>
                    )}
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/players/${row.playerId}`}
                        className="text-[10px] font-medium text-[var(--accent-strong)] hover:underline"
                      >
                        Profile
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}