"use client";

import { useState } from "react";
import { SortableHeader } from "@/components/sortable-header";
import {
  applySortDirection,
  compareText,
  getNextSortDirection,
  type SortDirection,
} from "@/lib/table-sort";

export type GeneratedExcludedTableRow = {
  coreTeam: string;
  explanation: string;
  playerId: string;
  playerName: string;
  position: string;
  trace: string;
};

export function GeneratedExcludedTable({
  rows,
}: {
  rows: GeneratedExcludedTableRow[];
}) {
  const [sortKey, setSortKey] = useState("player");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  function updateSort(nextSortKey: string) {
    setSortDirection((currentDirection) =>
      getNextSortDirection(sortKey, nextSortKey, currentDirection),
    );
    setSortKey(nextSortKey);
  }

  const sortedRows = [...rows].sort((left, right) => {
    if (sortKey === "trace") {
      return applySortDirection(compareText(left.trace, right.trace), sortDirection);
    }

    if (sortKey === "coreTeam") {
      return applySortDirection(compareText(left.coreTeam, right.coreTeam), sortDirection);
    }

    if (sortKey === "position") {
      return applySortDirection(compareText(left.position, right.position), sortDirection);
    }

    if (sortKey === "explanation") {
      return applySortDirection(compareText(left.explanation, right.explanation), sortDirection);
    }

    return applySortDirection(compareText(left.playerName, right.playerName), sortDirection);
  });

  return (
    <div className="overflow-x-auto rounded-2xl border app-hairline bg-[rgba(255,255,255,0.02)]">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead className="border-b app-hairline bg-[rgba(255,255,255,0.04)] text-xs uppercase tracking-wide app-copy-muted">
          <tr>
            <SortableHeader activeKey={sortKey} direction={sortDirection} label="Player" onSort={updateSort} sortKey="player" />
            <SortableHeader activeKey={sortKey} direction={sortDirection} label="Trace" onSort={updateSort} sortKey="trace" />
            <SortableHeader activeKey={sortKey} direction={sortDirection} label="Core Team" onSort={updateSort} sortKey="coreTeam" />
            <SortableHeader activeKey={sortKey} direction={sortDirection} label="Position" onSort={updateSort} sortKey="position" />
            <SortableHeader activeKey={sortKey} direction={sortDirection} label="Explanation" onSort={updateSort} sortKey="explanation" />
          </tr>
        </thead>
        <tbody className="divide-y app-hairline bg-transparent text-zinc-100">
          {sortedRows.map((row) => (
            <tr key={row.playerId} className="align-top">
              <td className="px-4 py-3 font-medium text-zinc-50">{row.playerName}</td>
              <td className="px-4 py-3 app-copy-soft">{row.trace}</td>
              <td className="px-4 py-3 app-copy-soft">{row.coreTeam}</td>
              <td className="px-4 py-3 app-copy-soft">{row.position}</td>
              <td className="px-4 py-3 app-copy-soft">{row.explanation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
