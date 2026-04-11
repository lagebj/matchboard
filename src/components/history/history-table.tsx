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

    return applySortDirection(compareText(formatPlayerName(left), formatPlayerName(right)), sortDirection);
  });

  return (
    <div className="overflow-x-auto border border-zinc-200 bg-white">
      <table className="w-full min-w-[1160px] border-collapse text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-100 text-xs uppercase tracking-wide text-zinc-600">
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
            <th className="px-4 py-3 font-semibold">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {sortedRows.map((row) => (
            <tr key={row.playerId} className="align-top">
              <td className="px-4 py-3 font-medium text-zinc-950">{formatPlayerName(row)}</td>
              <td className="px-4 py-3">{row.playerCode}</td>
              <td className="px-4 py-3">{row.coreTeamName}</td>
              <td className="px-4 py-3">{row.totalFinalizedAppearances}</td>
              <td className="px-4 py-3">{row.coreTeamAppearances}</td>
              <td className="px-4 py-3">{row.floatCount}</td>
              <td className="px-4 py-3">
                {row.lastFinalizedMatchDate ? formatDate(row.lastFinalizedMatchDate) : "-"}
              </td>
              <td className="max-w-sm px-4 py-3 text-zinc-700">{row.recentSelectionPattern}</td>
              <td className="px-4 py-3">
                <Link
                  className="inline-flex h-9 items-center rounded border border-zinc-300 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                  href={`/players/${row.playerId}`}
                >
                  Open player
                </Link>
              </td>
            </tr>
          ))}

          {sortedRows.length === 0 ? (
            <tr>
              <td className="px-4 py-10 text-center text-zinc-500" colSpan={9}>
                No players in the registry yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
