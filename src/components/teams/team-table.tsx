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
  developmentSlots: number;
  developmentSourceTeamIds: string[];
  developmentSourceTeamNames: string[];
  id: string;
  matches: number;
  maxSquadSize: number;
  minAcceptedSquadSize: number;
  minCorePlayers: number;
  minSupportCount: number;
  minSupportPlayers: number;
  name: string;
  removeAction: () => Promise<void>;
  saveAction: (formData: FormData) => Promise<void>;
  supportPriority: number;
  supportSourceTeamIds: string[];
  supportSourceTeamNames: string[];
  targetSquadSize: number;
  targetSupportCount: number;
  maxSupportCount: number;
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
    return <p className="text-xs app-copy-muted">No other active teams available.</p>;
  }

  return (
    <div className="grid gap-2">
      {teams.map((team) => (
        <label
          key={team.id}
          className="flex items-center gap-2 rounded-xl border app-hairline bg-[rgba(255,255,255,0.025)] px-3 py-2 text-sm app-copy-soft"
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

    if (sortKey === "matches") {
      return applySortDirection(compareNumber(left.matches, right.matches), sortDirection);
    }

    return applySortDirection(compareText(left.name, right.name), sortDirection);
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
          Team Board
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-zinc-50">
          Configure target teams with the operational context in view
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 app-copy-soft">
          Keep support demand, development slots, and source-team eligibility visible in the same row so setup decisions are easier to review.
        </p>
      </div>

      <div className="overflow-x-auto rounded-[1.4rem] border app-hairline bg-[rgba(12,15,20,0.45)]">
        <table className="w-full min-w-[1540px] border-collapse text-left text-sm">
          <thead className="border-b app-hairline bg-[rgba(255,255,255,0.04)] text-xs uppercase tracking-wide app-copy-muted">
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
              <th className="px-4 py-3 font-semibold">Squad Limits</th>
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
                label="Matches"
                onSort={updateSort}
                sortKey="matches"
              />
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y app-hairline">
            {sortedTeams.map((team) => {
              const isInUse =
                team.activeCorePlayers > 0 ||
                team.matches > 0 ||
                team.supportSourceTeamIds.length > 0 ||
                team.developmentSourceTeamIds.length > 0;
              const formId = `team-config-${team.id}`;
              const selectableTeams = availableTeams.filter((candidate) => candidate.id !== team.id);

              return (
                <tr key={team.id} className="align-top hover:bg-[rgba(255,255,255,0.03)]">
                  <td className="px-4 py-3 font-medium text-zinc-50">
                    <form action={team.saveAction} id={formId} />
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-3">
                        <span>{team.name}</span>
                        <button
                          className="shrink-0 rounded-full border app-hairline px-3 py-1 text-[11px] font-medium app-copy-soft hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-50"
                          form={formId}
                          type="submit"
                        >
                          Save
                        </button>
                      </div>
                      <span className="text-xs app-copy-muted">
                        Squad: {team.activeCorePlayers}/{team.targetSquadSize} · Min accepted: {team.minAcceptedSquadSize} · Max: {team.maxSquadSize}
                      </span>
                      <span className="text-xs app-copy-muted">
                        Support sources:{" "}
                        {team.supportSourceTeamNames.length > 0
                          ? team.supportSourceTeamNames.join(", ")
                          : "None"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex max-w-sm flex-col gap-3">
                      <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide app-copy-muted">
                        Min Support
                        <input
                          className="h-10 rounded-xl border app-hairline bg-[rgba(255,255,255,0.03)] px-3 text-sm font-normal text-zinc-50"
                          defaultValue={team.minSupportPlayers}
                          form={formId}
                          min={0}
                          name="minSupportPlayers"
                          required
                          type="number"
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide app-copy-muted">
                          Min Support Count
                          <input
                            className="h-10 rounded-xl border app-hairline bg-[rgba(255,255,255,0.03)] px-3 text-sm font-normal text-zinc-50"
                            defaultValue={team.minSupportCount}
                            form={formId}
                            min={0}
                            name="minSupportCount"
                            required
                            type="number"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide app-copy-muted">
                          Target Support
                          <input
                            className="h-10 rounded-xl border app-hairline bg-[rgba(255,255,255,0.03)] px-3 text-sm font-normal text-zinc-50"
                            defaultValue={team.targetSupportCount}
                            form={formId}
                            min={0}
                            name="targetSupportCount"
                            required
                            type="number"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide app-copy-muted">
                          Max Support
                          <input
                            className="h-10 rounded-xl border app-hairline bg-[rgba(255,255,255,0.03)] px-3 text-sm font-normal text-zinc-50"
                            defaultValue={team.maxSupportCount}
                            form={formId}
                            min={0}
                            name="maxSupportCount"
                            required
                            type="number"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide app-copy-muted">
                          Priority
                          <input
                            className="h-10 rounded-xl border app-hairline bg-[rgba(255,255,255,0.03)] px-3 text-sm font-normal text-zinc-50"
                            defaultValue={team.supportPriority}
                            form={formId}
                            min={0}
                            name="supportPriority"
                            required
                            type="number"
                          />
                        </label>
                      </div>
                      <div className="flex flex-col gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide app-copy-muted">
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
                      <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide app-copy-muted">
                        Development Slots
                        <input
                          className="h-10 rounded-xl border app-hairline bg-[rgba(255,255,255,0.03)] px-3 text-sm font-normal text-zinc-50"
                          defaultValue={team.developmentSlots}
                          form={formId}
                          min={0}
                          name="developmentSlots"
                          required
                          type="number"
                        />
                      </label>
                      <p className="text-xs font-semibold uppercase tracking-wide app-copy-muted">
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
                  <td className="px-4 py-3">
                    <div className="flex max-w-sm flex-col gap-3">
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide app-copy-muted">
                          Target Squad
                          <input
                            className="h-10 rounded-xl border app-hairline bg-[rgba(255,255,255,0.03)] px-3 text-sm font-normal text-zinc-50"
                            defaultValue={team.targetSquadSize}
                            form={formId}
                            min={1}
                            name="targetSquadSize"
                            required
                            type="number"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide app-copy-muted">
                          Min Accepted
                          <input
                            className="h-10 rounded-xl border app-hairline bg-[rgba(255,255,255,0.03)] px-3 text-sm font-normal text-zinc-50"
                            defaultValue={team.minAcceptedSquadSize}
                            form={formId}
                            min={1}
                            name="minAcceptedSquadSize"
                            required
                            type="number"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide app-copy-muted">
                          Max Squad
                          <input
                            className="h-10 rounded-xl border app-hairline bg-[rgba(255,255,255,0.03)] px-3 text-sm font-normal text-zinc-50"
                            defaultValue={team.maxSquadSize}
                            form={formId}
                            min={1}
                            name="maxSquadSize"
                            required
                            type="number"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide app-copy-muted">
                          Min Core
                          <input
                            className="h-10 rounded-xl border app-hairline bg-[rgba(255,255,255,0.03)] px-3 text-sm font-normal text-zinc-50"
                            defaultValue={team.minCorePlayers}
                            form={formId}
                            min={0}
                            name="minCorePlayers"
                            required
                            type="number"
                          />
                        </label>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-100">{team.activeCorePlayers}</td>
                  <td className="px-4 py-3 app-copy-soft">{team.matches}</td>
                  <td className="px-4 py-3">
                    <div className="flex max-w-xs flex-col gap-2">
                      <form action={team.removeAction}>
                        <button
                          className="h-9 w-full rounded-full border border-[rgba(185,128,119,0.3)] px-3 text-sm font-medium text-[var(--danger)] hover:bg-[rgba(185,128,119,0.08)] disabled:cursor-not-allowed disabled:border-[rgba(202,209,219,0.14)] disabled:text-[var(--text-muted)]"
                          disabled={isInUse}
                          type="submit"
                        >
                          Remove team
                        </button>
                      </form>
                      {isInUse ? (
                        <p className="text-xs leading-5 app-copy-muted">
                          Remove active players, support/development links, and matches that reference this team before deleting it.
                        </p>
                      ) : (
                        <p className="text-xs app-copy-muted">Unused teams can be removed.</p>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {sortedTeams.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center app-copy-muted" colSpan={8}>
                  No teams in the registry yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
