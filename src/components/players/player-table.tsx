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

function getAvailabilityPillClassName(availability: PlayerRow["currentAvailability"]) {
  if (availability === "AVAILABLE") {
    return "border-[rgba(140,167,146,0.28)] bg-[rgba(140,167,146,0.12)] text-[var(--accent-strong)]";
  }

  return "border-[rgba(208,176,127,0.26)] bg-[rgba(208,176,127,0.12)] text-[var(--warning)]";
}

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
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
          Scouting List
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-zinc-50">
          Scan availability, role fit, and float coverage quickly
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 app-copy-soft">
          Open the player profile when you need the full attribute and history view. Keep this
          table for fast registry checks and roster maintenance.
        </p>
      </div>

      <div className="overflow-hidden rounded-[1.4rem] border app-hairline bg-[rgba(12,15,20,0.45)]">
        <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
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
          <tbody className="divide-y app-hairline">
            {sortedPlayers.map((player) => {
              const floatTeams =
                player.isFloating && player.allowedFloatTeams.length > 0
                  ? player.allowedFloatTeams.map((entry) => entry.team.name).join(", ")
                  : "No";

              return (
                <tr
                  key={player.id}
                  className="align-top hover:bg-[rgba(255,255,255,0.035)]"
                >
                  <td className="px-4 py-3 font-medium text-zinc-50">
                    <Link
                      className="block rounded-xl px-2 py-2 -mx-2 -my-2 hover:bg-[rgba(255,255,255,0.05)]"
                      href={`/players/${player.id}`}
                    >
                      {formatPlayerName(player)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-100">{player.coreTeam.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] ${getAvailabilityPillClassName(player.currentAvailability)}`}
                    >
                      {formatAvailabilityStatus(player.currentAvailability)}
                    </span>
                  </td>
                  <td className="px-4 py-3 app-copy-soft">{getPlayerPositionSummary(player)}</td>
                  <td className="px-4 py-3 app-copy-soft">{floatTeams}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] ${
                        player.active
                          ? "border-[rgba(202,209,219,0.14)] bg-[rgba(255,255,255,0.04)] text-zinc-100"
                          : "border-[rgba(185,128,119,0.3)] bg-[rgba(185,128,119,0.1)] text-[var(--danger)]"
                      }`}
                    >
                      {player.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        className="inline-flex h-9 items-center rounded-full border app-hairline px-3 text-sm font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
                        href={`/players/${player.id}`}
                      >
                        Open profile
                      </Link>
                      <form action={player.removeAction}>
                        <button
                          className="h-9 rounded-full border border-[rgba(185,128,119,0.3)] px-3 text-sm font-medium text-[var(--danger)] hover:bg-[rgba(185,128,119,0.08)]"
                          type="submit"
                        >
                          Remove
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}

            {sortedPlayers.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center app-copy-muted" colSpan={7}>
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
