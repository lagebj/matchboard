"use client";

import Link from "next/link";
import { useState } from "react";
import { SortableHeader } from "@/components/sortable-header";
import { formatPlayerName } from "@/lib/player-metrics";
import { formatDate } from "@/lib/date-utils";
import {
  applySortDirection,
  compareDate,
  compareNumber,
  compareText,
  getNextSortDirection,
  type SortDirection,
} from "@/lib/table-sort";

export type PlayerHistoryRow = {
  coreTeamName: string;
  coreTeamAppearances: number;
  firstName: string;
  floatCount: number;
  latestMovementDate: Date | null;
  latestMovementReason: string;
  latestMovementSummary: string;
  lastFinalizedMatchDate: Date | null;
  lastName: string | null;
  playerCode: number;
  playerId: string;
  recentSelectionPattern: string;
  totalFinalizedAppearances: number;
};

export function HistoryTable({ rows }: { rows: PlayerHistoryRow[] }) {
  const [sortKey, setSortKey] = useState("player");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  function updateSort(nextSortKey: string) {
    setSortDirection((currentDirection) =>
      getNextSortDirection(sortKey, nextSortKey, currentDirection),
    );
    setSortKey(nextSortKey);
  }

  const sortedRows = [...rows].sort((left, right) => {
    if (sortKey === "code") {
      return applySortDirection(compareNumber(left.playerCode, right.playerCode), sortDirection);
    }

    if (sortKey === "team") {
      return applySortDirection(compareText(left.coreTeamName, right.coreTeamName), sortDirection);
    }

    if (sortKey === "total") {
      return applySortDirection(
        compareNumber(left.totalFinalizedAppearances, right.totalFinalizedAppearances),
        sortDirection,
      );
    }

    if (sortKey === "core") {
      return applySortDirection(
        compareNumber(left.coreTeamAppearances, right.coreTeamAppearances),
        sortDirection,
      );
    }

    if (sortKey === "float") {
      return applySortDirection(compareNumber(left.floatCount, right.floatCount), sortDirection);
    }

    if (sortKey === "lastMatch") {
      return applySortDirection(
        compareDate(left.lastFinalizedMatchDate, right.lastFinalizedMatchDate),
        sortDirection,
      );
    }

    if (sortKey === "pattern") {
      return applySortDirection(
        compareText(left.recentSelectionPattern, right.recentSelectionPattern),
        sortDirection,
      );
    }

    if (sortKey === "movement") {
      return applySortDirection(
        compareDate(left.latestMovementDate, right.latestMovementDate),
        sortDirection,
      );
    }

    if (sortKey === "movementReason") {
      return applySortDirection(
        compareText(left.latestMovementReason, right.latestMovementReason),
        sortDirection,
      );
    }

    return applySortDirection(compareText(formatPlayerName(left), formatPlayerName(right)), sortDirection);
  });

  const playersWithFloatHistory = rows.filter((row) => row.floatCount > 0).length;
  const playersWithCoreHistory = rows.filter((row) => row.coreTeamAppearances > 0).length;
  const recentMovers = rows.filter((row) => row.latestMovementDate !== null).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 lg:grid-cols-4">
        <div className="rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface)] px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
            Core History
          </p>
          <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{playersWithCoreHistory}</p>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            Players with at least one finalised core-team appearance in the current locked history.
          </p>
        </div>
        <div className="rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface)] px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
            Float History
          </p>
          <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{playersWithFloatHistory}</p>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            Players who have at least one finalised floating appearance in the latest saved match state.
          </p>
        </div>
        <div className="rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface)] px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
            Recent Movers
          </p>
          <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{recentMovers}</p>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            Players with a visible finalized move between teams in the current locked history.
          </p>
        </div>
        <div className="rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface)] px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
            Scan Tip
          </p>
          <p className="mt-2 text-sm font-medium text-[var(--foreground)]">Sort by latest move or why moved first.</p>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            That exposes who shifted teams most recently and why without opening player pages.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[var(--tl-c-radius-feature)] border border-[var(--border-soft)] bg-[var(--tl-c-surface)]">
        <table className="w-full min-w-[1440px] border-collapse text-left text-sm">
          <thead className="border-b border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] text-xs uppercase tracking-wide text-[var(--text-muted)]">
            <tr>
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="Player"
                onSort={updateSort}
                sortKey="player"
              />
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="Backend Code"
                onSort={updateSort}
                sortKey="code"
              />
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="Core Team"
                onSort={updateSort}
                sortKey="team"
              />
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="Finalised Appearances"
                onSort={updateSort}
                sortKey="total"
              />
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="Core Appearances"
                onSort={updateSort}
                sortKey="core"
              />
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="Float Appearances"
                onSort={updateSort}
                sortKey="float"
              />
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="Last Finalised Match"
                onSort={updateSort}
                sortKey="lastMatch"
              />
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="Recent Pattern"
                onSort={updateSort}
                sortKey="pattern"
              />
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="Latest Move"
                onSort={updateSort}
                sortKey="movement"
              />
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="Why Moved"
                onSort={updateSort}
                sortKey="movementReason"
              />
              <th className="px-4 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-soft)]">
            {sortedRows.map((row) => (
              <tr key={row.playerId} className="align-top hover:bg-[rgba(255,255,255,0.03)]">
                <td className="px-4 py-3 font-medium text-[var(--foreground)]">{formatPlayerName(row)}</td>
                <td className="px-4 py-3 text-[var(--text-soft)]">{row.playerCode}</td>
                <td className="px-4 py-3 text-[var(--foreground)]">{row.coreTeamName}</td>
                <td className="px-4 py-3 text-[var(--foreground)]">{row.totalFinalizedAppearances}</td>
                <td className="px-4 py-3 text-[var(--text-soft)]">{row.coreTeamAppearances}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] ${
                      row.floatCount > 0
                        ? "border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[var(--warning-subtle)] text-[var(--warning)]"
                        : "border-[var(--border-soft)] bg-[var(--tl-c-surface-hover)] text-[var(--text-soft)]"
                    }`}
                  >
                    {row.floatCount}
                  </span>
                </td>
                <td className="px-4 py-3 text-[var(--text-soft)]">
                  {row.lastFinalizedMatchDate ? formatDate(row.lastFinalizedMatchDate) : "-"}
                </td>
                <td className="max-w-sm px-4 py-3 text-[var(--text-soft)]">{row.recentSelectionPattern}</td>
                <td className="px-4 py-3">
                  {row.latestMovementDate ? (
                    <span className="inline-flex rounded-full border border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[var(--warning-subtle)] px-3 py-1 text-xs font-medium text-[var(--warning)]">
                      {row.latestMovementSummary}
                    </span>
                  ) : (
                    <span className="text-[var(--text-soft)]">-</span>
                  )}
                </td>
                <td className="max-w-md px-4 py-3 text-[var(--text-soft)]">
                  {row.latestMovementDate ? row.latestMovementReason : "-"}
                </td>
                <td className="px-4 py-3">
                  <Link
                    className="inline-flex h-9 items-center rounded-full border border-[var(--border-soft)] px-3 text-sm font-medium text-[var(--text-soft)] hover:bg-[var(--tl-c-surface-hover)] hover:text-[var(--foreground)]"
                    href={`/players/${row.playerId}`}
                  >
                    Open player
                  </Link>
                </td>
              </tr>
            ))}

            {sortedRows.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-[var(--text-muted)]" colSpan={11}>
                  No players in the registry yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
