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
  | "matchdayAdditions"
  | "plannedButAbsent";

type SortDirection = "asc" | "desc";

type MovementFilter = "all" | "has_support" | "has_development" | "has_matchday_additions";
type AttendanceFilter = "all" | "has_planned_absent";

export function SeasonOverviewTable({
  rows,
  planningPeriodLabel,
  reportedMatchCount,
  totalActualAppearances,
  totalMatchdayAdditions,
  teams,
}: SeasonOverviewTableProps) {
  const [sortField, setSortField] = useState<SortField>("actualAppearances");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [movementFilter, setMovementFilter] = useState<MovementFilter>("all");
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceFilter>("all");
  const [search, setSearch] = useState("");

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
    }

    if (attendanceFilter === "has_planned_absent") {
      result = result.filter((r) => r.plannedButAbsent > 0);
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
  }, [rows, search, teamFilter, movementFilter, attendanceFilter, sortField, sortDir]);

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
          <option value="has_matchday_additions">Has matchday additions</option>
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
                {renderSortHeader("matchdayAdditions", "Matchday additions")}
                {renderSortHeader("plannedButAbsent", "Planned absent")}
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Review
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)]">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-sm text-zinc-500">
                    No players match the current filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.playerId} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
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
                    <td className="px-3 py-2 text-zinc-300 tabular-nums">
                      {row.matchdayAdditions > 0 ? row.matchdayAdditions : "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-300 tabular-nums">
                      {row.plannedButAbsent > 0 ? row.plannedButAbsent : "—"}
                    </td>
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