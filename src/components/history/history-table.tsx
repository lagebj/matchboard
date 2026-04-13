"use client";

import Link from "next/link";
import { useState } from "react";
import { SortableHeader } from "@/components/sortable-header";
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

function formatPlayerName(row: PlayerHistoryRow): string {
  return row.lastName ? `${row.firstName} ${row.lastName}` : row.firstName;
}

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
        <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
            Core History
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-50">{playersWithCoreHistory}</p>
          <p className="mt-2 text-sm app-copy-soft">
            Players with at least one finalized core-team appearance in the visible history.
          </p>
        </div>
        <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
            Float History
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-50">{playersWithFloatHistory}</p>
          <p className="mt-2 text-sm app-copy-soft">
            Players who have at least one finalized floating appearance recorded.
          </p>
        </div>
        <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
            Recent Movers
          </p>
          <p className="mt-2 text-2xl font-semibold text-zinc-50">{recentMovers}</p>
          <p className="mt-2 text-sm app-copy-soft">
            Players with a visible finalized move between teams in the current history.
          </p>
        </div>
        <div className="rounded-2xl border app-hairline bg-[rgba(255,255,255,0.025)] px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] app-copy-muted">
            Scan Tip
          </p>
          <p className="mt-2 text-sm font-medium text-zinc-100">Sort by latest move or why moved first.</p>
          <p className="mt-2 text-sm app-copy-soft">
            That exposes who shifted teams most recently and why without opening player pages.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-[1.4rem] border app-hairline bg-[rgba(12,15,20,0.45)]">
        <table className="w-full min-w-[1440px] border-collapse text-left text-sm">
          <thead className="border-b app-hairline bg-[rgba(255,255,255,0.04)] text-xs uppercase tracking-wide app-copy-muted">
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
                label="Finalized Appearances"
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
                label="Last Finalized Match"
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
          <tbody className="divide-y app-hairline">
            {sortedRows.map((row) => (
              <tr key={row.playerId} className="align-top hover:bg-[rgba(255,255,255,0.03)]">
                <td className="px-4 py-3 font-medium text-zinc-50">{formatPlayerName(row)}</td>
                <td className="px-4 py-3 app-copy-soft">{row.playerCode}</td>
                <td className="px-4 py-3 text-zinc-100">{row.coreTeamName}</td>
                <td className="px-4 py-3 text-zinc-100">{row.totalFinalizedAppearances}</td>
                <td className="px-4 py-3 app-copy-soft">{row.coreTeamAppearances}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] ${
                      row.floatCount > 0
                        ? "border-[rgba(208,176,127,0.26)] bg-[rgba(208,176,127,0.12)] text-[var(--warning)]"
                        : "border-[rgba(202,209,219,0.14)] bg-[rgba(255,255,255,0.04)] text-[var(--text-soft)]"
                    }`}
                  >
                    {row.floatCount}
                  </span>
                </td>
                <td className="px-4 py-3 app-copy-soft">
                  {row.lastFinalizedMatchDate ? formatDate(row.lastFinalizedMatchDate) : "-"}
                </td>
                <td className="max-w-sm px-4 py-3 app-copy-soft">{row.recentSelectionPattern}</td>
                <td className="px-4 py-3">
                  {row.latestMovementDate ? (
                    <span className="inline-flex rounded-full border border-[rgba(208,176,127,0.26)] bg-[rgba(208,176,127,0.12)] px-3 py-1 text-xs font-medium text-[var(--warning)]">
                      {row.latestMovementSummary}
                    </span>
                  ) : (
                    <span className="app-copy-soft">-</span>
                  )}
                </td>
                <td className="max-w-md px-4 py-3 app-copy-soft">
                  {row.latestMovementDate ? row.latestMovementReason : "-"}
                </td>
                <td className="px-4 py-3">
                  <Link
                    className="inline-flex h-9 items-center rounded-full border app-hairline px-3 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
                    href={`/players/${row.playerId}`}
                  >
                    Open player
                  </Link>
                </td>
              </tr>
            ))}

            {sortedRows.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center app-copy-muted" colSpan={11}>
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
