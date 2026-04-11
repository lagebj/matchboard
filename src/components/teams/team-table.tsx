"use client";

import { useState } from "react";
import { SortableHeader } from "@/components/sortable-header";
import {
  applySortDirection,
  compareNumber,
  compareText,
  getNextSortDirection,
  type SortDirection,
} from "@/lib/table-sort";

type TeamOption = {
  id: string;
  name: string;
};

type TeamRow = {
  activeCorePlayers: number;
  activeFloatLinks: number;
  developmentSlots: number;
  developmentSourceTeamIds: string[];
  developmentSourceTeamNames: string[];
  id: string;
  matches: number;
  minSupportPlayers: number;
  name: string;
  removeAction: () => Promise<void>;
  saveAction: (formData: FormData) => Promise<void>;
  supportSourceTeamIds: string[];
  supportSourceTeamNames: string[];
};

function TeamSourceChecklist({
  defaultSelectedIds,
  fieldName,
  formId,
  teams,
}: {
  defaultSelectedIds: string[];
  fieldName: string;
  formId: string;
  teams: TeamOption[];
}) {
  if (teams.length === 0) {
    return <p className="text-xs text-zinc-500">No other active teams available.</p>;
  }

  return (
    <div className="grid gap-2">
      {teams.map((team) => (
        <label
          key={team.id}
          className="flex items-center gap-2 rounded border border-zinc-200 px-3 py-2 text-sm"
        >
          <input
            defaultChecked={defaultSelectedIds.includes(team.id)}
            form={formId}
            name={fieldName}
            type="checkbox"
            value={team.id}
          />
          <span>{team.name}</span>
        </label>
      ))}
    </div>
  );
}

export function TeamTable({
  availableTeams,
  teams,
}: {
  availableTeams: TeamOption[];
  teams: TeamRow[];
}) {
  const [sortKey, setSortKey] = useState("team");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  function updateSort(nextSortKey: string) {
    setSortDirection((currentDirection) =>
      getNextSortDirection(sortKey, nextSortKey, currentDirection),
    );
    setSortKey(nextSortKey);
  }

  const sortedTeams = [...teams].sort((left, right) => {
    if (sortKey === "support") {
      return applySortDirection(
        compareNumber(left.minSupportPlayers, right.minSupportPlayers),
        sortDirection,
      );
    }

    if (sortKey === "developmentSlots") {
      return applySortDirection(compareNumber(left.developmentSlots, right.developmentSlots), sortDirection);
    }

    if (sortKey === "players") {
      return applySortDirection(compareNumber(left.activeCorePlayers, right.activeCorePlayers), sortDirection);
    }

    if (sortKey === "floatLinks") {
      return applySortDirection(compareNumber(left.activeFloatLinks, right.activeFloatLinks), sortDirection);
    }

    if (sortKey === "matches") {
      return applySortDirection(compareNumber(left.matches, right.matches), sortDirection);
    }

    return applySortDirection(compareText(left.name, right.name), sortDirection);
  });

  return (
    <div className="overflow-x-auto border border-zinc-200 bg-white">
      <table className="w-full min-w-[1360px] border-collapse text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-100 text-xs uppercase tracking-wide text-zinc-600">
          <tr>
            <SortableHeader
              activeKey={sortKey}
              direction={sortDirection}
              label="Team"
              onSort={updateSort}
              sortKey="team"
            />
            <th className="px-4 py-3 font-semibold">Support Setup</th>
            <th className="px-4 py-3 font-semibold">Development Setup</th>
            <SortableHeader
              activeKey={sortKey}
              direction={sortDirection}
              label="Players"
              onSort={updateSort}
              sortKey="players"
            />
            <SortableHeader
              activeKey={sortKey}
              direction={sortDirection}
              label="Float Links"
              onSort={updateSort}
              sortKey="floatLinks"
            />
            <SortableHeader
              activeKey={sortKey}
              direction={sortDirection}
              label="Matches"
              onSort={updateSort}
              sortKey="matches"
            />
            <th className="px-4 py-3 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {sortedTeams.map((team) => {
            const isInUse =
              team.activeCorePlayers > 0 ||
              team.activeFloatLinks > 0 ||
              team.matches > 0 ||
              team.supportSourceTeamIds.length > 0 ||
              team.developmentSourceTeamIds.length > 0;
            const formId = `team-config-${team.id}`;
            const selectableTeams = availableTeams.filter((candidate) => candidate.id !== team.id);

            return (
              <tr key={team.id} className="align-top">
                <td className="px-4 py-3 font-medium text-zinc-950">
                  <form action={team.saveAction} id={formId} />
                  <div className="flex flex-col gap-1">
                    <span>{team.name}</span>
                    <span className="text-xs text-zinc-500">
                      Current support sources:{" "}
                      {team.supportSourceTeamNames.length > 0
                        ? team.supportSourceTeamNames.join(", ")
                        : "None"}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex max-w-sm flex-col gap-3">
                    <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Min Support
                      <input
                        className="h-9 border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-950"
                        defaultValue={team.minSupportPlayers}
                        form={formId}
                        min={0}
                        name="minSupportPlayers"
                        required
                        type="number"
                      />
                    </label>
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Allowed Support Teams
                      </p>
                      <TeamSourceChecklist
                        defaultSelectedIds={team.supportSourceTeamIds}
                        fieldName="supportSourceTeamIds"
                        formId={formId}
                        teams={selectableTeams}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex max-w-sm flex-col gap-3">
                    <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Development Slots
                      <input
                        className="h-9 border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-950"
                        defaultValue={team.developmentSlots}
                        form={formId}
                        min={0}
                        name="developmentSlots"
                        required
                        type="number"
                      />
                    </label>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Allowed Development Teams
                    </p>
                    <TeamSourceChecklist
                      defaultSelectedIds={team.developmentSourceTeamIds}
                      fieldName="developmentSourceTeamIds"
                      formId={formId}
                      teams={selectableTeams}
                    />
                  </div>
                </td>
                <td className="px-4 py-3">{team.activeCorePlayers}</td>
                <td className="px-4 py-3">{team.activeFloatLinks}</td>
                <td className="px-4 py-3">{team.matches}</td>
                <td className="px-4 py-3">
                  <div className="flex max-w-xs flex-col gap-2">
                    <button
                      className="h-9 rounded border border-zinc-300 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                      form={formId}
                      type="submit"
                    >
                      Save setup
                    </button>
                    <form action={team.removeAction}>
                      <button
                        className="h-9 w-full rounded border border-zinc-300 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-400"
                        disabled={isInUse}
                        type="submit"
                      >
                        Remove team
                      </button>
                    </form>
                    {isInUse ? (
                      <p className="text-xs leading-5 text-zinc-500">
                        Remove active players, active float links, support/development links, and matches that reference this team before deleting it.
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-500">Unused teams can be removed.</p>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}

          {sortedTeams.length === 0 ? (
            <tr>
              <td className="px-4 py-10 text-center text-zinc-500" colSpan={7}>
                No teams in the registry yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
