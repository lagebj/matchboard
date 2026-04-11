"use client";

import { useState } from "react";
import { SortableHeader } from "@/components/sortable-header";
import {
  applySortDirection,
  compareText,
  getNextSortDirection,
  type SortDirection,
} from "@/lib/table-sort";

export type SavedSelectionTableRow = {
  explanation: string;
  id: string;
  playerName: string;
  role: string;
  sourceTeam: string;
  trace: string;
};

export function SavedSelectionTable({
  rows,
}: {
  rows: SavedSelectionTableRow[];
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
    if (sortKey === "role") {
      return applySortDirection(compareText(left.role, right.role), sortDirection);
    }

    if (sortKey === "sourceTeam") {
      return applySortDirection(compareText(left.sourceTeam, right.sourceTeam), sortDirection);
    }

    if (sortKey === "trace") {
      return applySortDirection(compareText(left.trace, right.trace), sortDirection);
    }

    if (sortKey === "explanation") {
      return applySortDirection(compareText(left.explanation, right.explanation), sortDirection);
    }

    return applySortDirection(compareText(left.playerName, right.playerName), sortDirection);
  });

  return (
    <div className="overflow-x-auto border border-zinc-200">
      <table className="w-full min-w-[980px] border-collapse text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-100 text-xs uppercase tracking-wide text-zinc-600">
          <tr>
            <SortableHeader activeKey={sortKey} direction={sortDirection} label="Player" onSort={updateSort} sortKey="player" />
            <SortableHeader activeKey={sortKey} direction={sortDirection} label="Role" onSort={updateSort} sortKey="role" />
            <SortableHeader activeKey={sortKey} direction={sortDirection} label="Source Team" onSort={updateSort} sortKey="sourceTeam" />
            <SortableHeader activeKey={sortKey} direction={sortDirection} label="Trace" onSort={updateSort} sortKey="trace" />
            <SortableHeader activeKey={sortKey} direction={sortDirection} label="Explanation" onSort={updateSort} sortKey="explanation" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 bg-white">
          {sortedRows.map((row) => (
            <tr key={row.id} className="align-top">
              <td className="px-4 py-3 font-medium text-zinc-950">{row.playerName}</td>
              <td className="px-4 py-3">{row.role}</td>
              <td className="px-4 py-3">{row.sourceTeam}</td>
              <td className="px-4 py-3">{row.trace}</td>
              <td className="px-4 py-3 text-zinc-700">{row.explanation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
