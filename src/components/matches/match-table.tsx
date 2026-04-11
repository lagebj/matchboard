"use client";

import Link from "next/link";
import { useState } from "react";
import { SortableHeader } from "@/components/sortable-header";
import { formatDate } from "@/lib/date-utils";
import { formatMatchVenue } from "@/lib/match-utils";
import {
  applySortDirection,
  compareDate,
  compareNumber,
  compareText,
  getNextSortDirection,
  type SortDirection,
} from "@/lib/table-sort";

type MatchRow = {
  createdAt: Date;
  deleteAction: () => Promise<void>;
  homeOrAway: "HOME" | "AWAY";
  id: string;
  latestSelectionStatus: "DRAFT" | "FINALIZED" | null;
  matchType: string | null;
  notes: string | null;
  opponent: string;
  squadSize: number;
  startsAt: Date;
  targetTeam: {
    id: string;
    name: string;
  };
};

type MatchTableProps = {
  finalizeAllAction: () => Promise<void>;
  matches: MatchRow[];
  recalculateAction: (formData: FormData) => Promise<void>;
};

function formatSelectionStatus(status: MatchRow["latestSelectionStatus"]) {
  if (status === "FINALIZED") {
    return "Finalized";
  }

  if (status === "DRAFT") {
    return "Draft";
  }

  return "None";
}

export function MatchTable({ finalizeAllAction, matches, recalculateAction }: MatchTableProps) {
  const [sortKey, setSortKey] = useState("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  function updateSort(nextSortKey: string) {
    setSortDirection((currentDirection) =>
      getNextSortDirection(sortKey, nextSortKey, currentDirection),
    );
    setSortKey(nextSortKey);
  }

  const sortedMatches = [...matches].sort((left, right) => {
    if (sortKey === "team") {
      return applySortDirection(compareText(left.targetTeam.name, right.targetTeam.name), sortDirection);
    }

    if (sortKey === "opponent") {
      return applySortDirection(compareText(left.opponent, right.opponent), sortDirection);
    }

    if (sortKey === "size") {
      return applySortDirection(compareNumber(left.squadSize, right.squadSize), sortDirection);
    }

    if (sortKey === "type") {
      return applySortDirection(compareText(left.matchType, right.matchType), sortDirection);
    }

    if (sortKey === "venue") {
      return applySortDirection(
        compareText(formatMatchVenue(left.homeOrAway), formatMatchVenue(right.homeOrAway)),
        sortDirection,
      );
    }

    if (sortKey === "selection") {
      return applySortDirection(
        compareText(formatSelectionStatus(left.latestSelectionStatus), formatSelectionStatus(right.latestSelectionStatus)),
        sortDirection,
      );
    }

    return applySortDirection(compareDate(left.startsAt, right.startsAt), sortDirection);
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600">
          Recalculate draft selections or finalize every ready non-finalized match from the overview.
        </p>
        <form action={recalculateAction} className="flex flex-wrap gap-2" id="recalculate-matches">
          <button
            className="h-9 rounded border border-zinc-300 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            formAction={finalizeAllAction}
            type="submit"
          >
            Finalize all ready matches
          </button>
          <button
            className="h-9 rounded border border-zinc-300 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            name="scope"
            type="submit"
            value="selected"
          >
            Recalculate selected
          </button>
          <button
            className="h-9 rounded border border-zinc-300 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            name="scope"
            type="submit"
            value="all"
          >
            Recalculate all drafts
          </button>
        </form>
      </div>

      <div className="overflow-x-auto border border-zinc-200 bg-white">
        <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-100 text-xs uppercase tracking-wide text-zinc-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Pick</th>
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="Date"
                onSort={updateSort}
                sortKey="date"
              />
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="Target Team"
                onSort={updateSort}
                sortKey="team"
              />
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="Home/Away"
                onSort={updateSort}
                sortKey="venue"
              />
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="Opponent"
                onSort={updateSort}
                sortKey="opponent"
              />
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="Squad Size"
                onSort={updateSort}
                sortKey="size"
              />
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="Match Type"
                onSort={updateSort}
                sortKey="type"
              />
              <SortableHeader
                activeKey={sortKey}
                direction={sortDirection}
                label="Selection"
                onSort={updateSort}
                sortKey="selection"
              />
              <th className="px-4 py-3 font-semibold">Notes</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {sortedMatches.map((match) => {
              const canRecalculate = match.latestSelectionStatus !== "FINALIZED";

              return (
                <tr key={match.id} className="align-top">
                  <td className="px-4 py-3">
                    <input
                      disabled={!canRecalculate}
                      form="recalculate-matches"
                      name="selectedMatchIds"
                      type="checkbox"
                      value={match.id}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-950">
                    <Link
                      className="block rounded px-1 py-1 -mx-1 -my-1 hover:bg-zinc-100"
                      href={`/selection/${match.id}`}
                    >
                      {formatDate(match.startsAt)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      className="block rounded px-1 py-1 -mx-1 -my-1 hover:bg-zinc-100"
                      href={`/selection/${match.id}`}
                    >
                      {match.targetTeam.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{formatMatchVenue(match.homeOrAway)}</td>
                  <td className="px-4 py-3">{match.opponent}</td>
                  <td className="px-4 py-3">{match.squadSize}</td>
                  <td className="px-4 py-3">{match.matchType ?? "-"}</td>
                  <td className="px-4 py-3">{formatSelectionStatus(match.latestSelectionStatus)}</td>
                  <td className="max-w-sm px-4 py-3 text-zinc-600">
                    {match.notes ? (
                      <span className="line-clamp-3 whitespace-pre-wrap">{match.notes}</span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <form action={match.deleteAction}>
                      <button
                        className="h-9 rounded border border-zinc-300 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                        type="submit"
                      >
                        Remove match
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}

            {sortedMatches.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-zinc-500" colSpan={10}>
                  No matches created yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
