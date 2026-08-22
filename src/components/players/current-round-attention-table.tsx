"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { PlayerCurrentRoundAttentionRow } from "@/lib/players/get-players-overview";
import { ResponsiveTable, ResponsiveTableCard } from "@/components/ui/responsive-table";

type CurrentRoundAttentionTableProps = {
  rows: PlayerCurrentRoundAttentionRow[];
  roundLabel: string;
  roundId: string;
  teams: Array<{ id: string; name: string }>;
};

const stateOrder: Record<string, number> = {
  BLOCKED_UNAVAILABLE_SELECTION: 0,
  BLOCKED_INVALID_PLAN: 1,
  DECISION_REQUIRED_NO_PLANNED_MATCH: 2,
  COVERED: 3,
  UNCONFIRMED: 4,
  NOT_AVAILABLE: 5,
};

const stateLabels: Record<string, { label: string; variant: "blocked" | "decision" | "covered" | "unavailable" | "unconfirmed" }> = {
  BLOCKED_UNAVAILABLE_SELECTION: { label: "Blocked", variant: "blocked" },
  BLOCKED_INVALID_PLAN: { label: "Blocked", variant: "blocked" },
  DECISION_REQUIRED_NO_PLANNED_MATCH: { label: "Decision required", variant: "decision" },
  COVERED: { label: "Covered", variant: "covered" },
  UNCONFIRMED: { label: "Unconfirmed", variant: "unconfirmed" },
  NOT_AVAILABLE: { label: "Not available", variant: "unavailable" },
};

const stateStyles: Record<string, string> = {
  blocked: "text-red-300 bg-red-950/30 border-red-800/40",
  decision: "text-amber-300 bg-amber-950/30 border-amber-700/40",
  covered: "text-emerald-300 bg-emerald-950/30 border-emerald-800/40",
  unavailable: "text-zinc-400 bg-zinc-800/30 border-zinc-700/40",
  unconfirmed: "text-zinc-400 bg-zinc-800/30 border-zinc-700/40",
};

type StateFilter = "all" | "blocked" | "decision" | "covered" | "not_available" | "unconfirmed";

export function CurrentRoundAttentionTable({
  rows,
  roundLabel,
  roundId,
  teams,
}: CurrentRoundAttentionTableProps) {
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(() => {
    let result = rows;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) => r.displayName.toLowerCase().includes(q));
    }

    if (teamFilter !== "all") {
      result = result.filter((r) => r.coreTeam?.id === teamFilter);
    }

    if (stateFilter !== "all") {
      result = result.filter((r) => {
        if (stateFilter === "blocked") return r.integrityState.startsWith("BLOCKED");
        if (stateFilter === "decision") return r.integrityState === "DECISION_REQUIRED_NO_PLANNED_MATCH";
        if (stateFilter === "covered") return r.integrityState === "COVERED";
        if (stateFilter === "not_available") return r.integrityState === "NOT_AVAILABLE";
        if (stateFilter === "unconfirmed") return r.integrityState === "UNCONFIRMED";
        return true;
      });
    }

    return [...result].sort((a, b) => {
      const aOrder = stateOrder[a.integrityState] ?? 99;
      const bOrder = stateOrder[b.integrityState] ?? 99;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [rows, search, teamFilter, stateFilter]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-zinc-500">
        Planned match opportunity and active integrity decisions for{" "}
        <span className="font-medium text-zinc-400">{roundLabel}</span>.
      </p>

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
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value as StateFilter)}
          className="h-8 rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-[var(--accent-strong)]"
          aria-label="Filter by state"
        >
          <option value="all">All states</option>
          <option value="blocked">Blocked</option>
          <option value="decision">Decision required</option>
          <option value="covered">Covered</option>
          <option value="not_available">Not available</option>
          <option value="unconfirmed">Unconfirmed</option>
        </select>
      </div>

      <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] overflow-hidden">
        <ResponsiveTable
          items={filteredRows}
          getKey={(row) => row.playerId}
          cardListClassName="p-3"
          emptyState={
            <p className="px-4 py-8 text-center text-sm text-zinc-500">
              No players match the current filters.
            </p>
          }
          renderTable={() => (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-soft)] bg-[var(--surface-muted)]">
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Player</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Core team</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Availability</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Planned opportunity</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Role</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">State</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-soft)]">
                  {filteredRows.map((row) => {
                    const stateInfo = stateLabels[row.integrityState] ?? { label: row.integrityState, variant: "unconfirmed" as const };
                    return (
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
                        <td className="px-3 py-2">
                          <AvailabilityBadge availability={row.availability} />
                        </td>
                        <td className="px-3 py-2 text-zinc-300">
                          {row.currentAssignment ? (
                            <span>{row.currentAssignment.teamName} vs {row.currentAssignment.opponent}</span>
                          ) : (
                            <span className="text-zinc-500 italic">Not selected this round</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-zinc-300">
                          {row.currentAssignment?.role ?? <span className="text-zinc-500">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${stateStyles[stateInfo.variant]}`}>
                            {stateInfo.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {(row.integrityState.startsWith("BLOCKED") || row.integrityState === "DECISION_REQUIRED_NO_PLANNED_MATCH") ? (
                            <Link
                              href={`/rounds/${roundId}`}
                              className="text-[10px] font-medium text-[var(--accent-strong)] hover:underline"
                            >
                              Open Round Board
                            </Link>
                          ) : (
                            <span className="text-[10px] text-zinc-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          renderCard={(row) => {
            const stateInfo = stateLabels[row.integrityState] ?? { label: row.integrityState, variant: "unconfirmed" as const };
            const needsAction =
              row.integrityState.startsWith("BLOCKED") || row.integrityState === "DECISION_REQUIRED_NO_PLANNED_MATCH";
            return (
              <ResponsiveTableCard
                title={row.displayName}
                titleHref={`/players/${row.playerId}`}
                fields={[
                  { label: "Core team", value: row.coreTeam?.name ?? "Unassigned" },
                  { label: "Availability", value: <AvailabilityBadge availability={row.availability} /> },
                  {
                    label: "Planned opportunity",
                    value: row.currentAssignment
                      ? `${row.currentAssignment.teamName} vs ${row.currentAssignment.opponent}`
                      : "Not selected this round",
                  },
                  { label: "Role", value: row.currentAssignment?.role ?? "—" },
                  {
                    label: "State",
                    value: (
                      <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${stateStyles[stateInfo.variant]}`}>
                        {stateInfo.label}
                      </span>
                    ),
                  },
                ]}
                actions={
                  needsAction ? (
                    <Link
                      href={`/rounds/${roundId}`}
                      className="text-[11px] font-medium text-[var(--accent-strong)] hover:underline"
                    >
                      Open Round Board
                    </Link>
                  ) : undefined
                }
              />
            );
          }}
        />
      </div>
    </div>
  );
}

function AvailabilityBadge({ availability }: { availability: string }) {
  const styles: Record<string, string> = {
    AVAILABLE: "text-emerald-400",
    INJURED: "text-red-400",
    SICK: "text-amber-400",
    AWAY: "text-zinc-400",
    TENTATIVE: "text-amber-300",
    UNKNOWN: "text-zinc-500",
  };

  const labels: Record<string, string> = {
    AVAILABLE: "Available",
    INJURED: "Injured",
    SICK: "Sick",
    AWAY: "Away",
    TENTATIVE: "Tentative",
    UNKNOWN: "Unknown",
  };

  return (
    <span className={`text-xs ${styles[availability] ?? "text-zinc-500"}`}>
      {labels[availability] ?? availability}
    </span>
  );
}