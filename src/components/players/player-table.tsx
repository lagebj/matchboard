"use client";

import Link from "next/link";
import { useState } from "react";
import { SortableHeader } from "@/components/sortable-header";
import { formatAvailabilityStatus, formatPlayerName, getPlayerPositionSummary } from "@/lib/player-metrics";
import {
  applySortDirection,
  compareText,
  getNextSortDirection,
  type SortDirection,
} from "@/lib/table-sort";

type PlayerRow = {
  active: boolean;
  allowedFloatTeams: Array<{
    team: {
      id: string;
      name: string;
    };
  }>;
  coreTeam: {
    id: string;
    name: string;
  };
  currentAvailability: "AVAILABLE" | "INJURED" | "SICK" | "AWAY";
  firstName: string;
  id: string;
  isFloating: boolean;
  lastName: string | null;
  primaryPosition: string;
  removeAction: () => Promise<void>;
  secondaryPosition: string | null;
  tertiaryPosition: string | null;
};

export function PlayerTable({ players }: { players: PlayerRow[] }) {
  const [sortKey, setSortKey] = useState("player");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  function updateSort(nextSortKey: string) {
    setSortDirection((currentDirection) =>
      getNextSortDirection(sortKey, nextSortKey, currentDirection),
    );
    setSortKey(nextSortKey);
  }

  const sortedPlayers = [...players].sort((left, right) => {
    if (sortKey === "coreTeam") {
      return applySortDirection(compareText(left.coreTeam.name, right.coreTeam.name), sortDirection);
    }

    if (sortKey === "availability") {
      return applySortDirection(
        compareText(
          formatAvailabilityStatus(left.currentAvailability),
          formatAvailabilityStatus(right.currentAvailability),
        ),
        sortDirection,
      );
    }

    if (sortKey === "positions") {
      return applySortDirection(
        compareText(getPlayerPositionSummary(left), getPlayerPositionSummary(right)),
        sortDirection,
      );
    }

    if (sortKey === "floating") {
      return applySortDirection(
        compareText(
          left.isFloating && left.allowedFloatTeams.length > 0
            ? left.allowedFloatTeams.map((entry) => entry.team.name).join(", ")
            : "No",
          right.isFloating && right.allowedFloatTeams.length > 0
            ? right.allowedFloatTeams.map((entry) => entry.team.name).join(", ")
            : "No",
        ),
        sortDirection,
      );
    }

    if (sortKey === "status") {
      return applySortDirection(
        compareText(left.active ? "Active" : "Inactive", right.active ? "Active" : "Inactive"),
        sortDirection,
      );
    }

    return applySortDirection(compareText(formatPlayerName(left), formatPlayerName(right)), sortDirection);
  });

  return (
    <div className="overflow-x-auto border border-zinc-200 bg-white">
      <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
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
              label="Core Team"
              onSort={updateSort}
              sortKey="coreTeam"
            />
            <SortableHeader
              activeKey={sortKey}
              direction={sortDirection}
              label="Availability"
              onSort={updateSort}
              sortKey="availability"
            />
            <SortableHeader
              activeKey={sortKey}
              direction={sortDirection}
              label="Positions"
              onSort={updateSort}
              sortKey="positions"
            />
            <SortableHeader
              activeKey={sortKey}
              direction={sortDirection}
              label="Floating"
              onSort={updateSort}
              sortKey="floating"
            />
            <SortableHeader
              activeKey={sortKey}
              direction={sortDirection}
              label="Status"
              onSort={updateSort}
              sortKey="status"
            />
            <th className="px-4 py-3 font-semibold">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {sortedPlayers.map((player) => {
            return (
              <tr key={player.id} className="align-top">
                <td className="px-4 py-3 font-medium text-zinc-950">
                  <Link
                    className="block rounded px-1 py-1 -mx-1 -my-1 hover:bg-zinc-100"
                    href={`/players/${player.id}`}
                  >
                    {formatPlayerName(player)}
                  </Link>
                </td>
                <td className="px-4 py-3">{player.coreTeam.name}</td>
                <td className="px-4 py-3">{formatAvailabilityStatus(player.currentAvailability)}</td>
                <td className="px-4 py-3">{getPlayerPositionSummary(player)}</td>
                <td className="px-4 py-3">
                  {player.isFloating && player.allowedFloatTeams.length > 0
                    ? player.allowedFloatTeams.map((entry) => entry.team.name).join(", ")
                    : "No"}
                </td>
                <td className="px-4 py-3">{player.active ? "Active" : "Inactive"}</td>
                <td className="px-4 py-3">
                  <form action={player.removeAction}>
                    <button
                      className="h-9 rounded border border-red-300 px-3 text-sm font-medium text-red-700 hover:bg-red-50"
                      type="submit"
                    >
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
            );
          })}

          {sortedPlayers.length === 0 ? (
            <tr>
              <td className="px-4 py-10 text-center text-zinc-500" colSpan={7}>
                No players in the registry yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
