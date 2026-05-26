"use client";

import { useTransition, useState } from "react";
import Link from "next/link";
import { updatePlayerCoreTeamAction } from "@/app/(app)/players/actions";

type ManageBaseGroupsViewProps = {
  players: Array<{
    id: string;
    firstName: string;
    lastName: string | null;
    coreTeam: { id: string; name: string } | null;
    primaryPosition: string | null;
    currentAvailability: string;
    nonRotatable: boolean;
    reducedMatchLoadAllowed: boolean;
  }>;
  teams: Array<{ id: string; name: string }>;
};

export function ManageBaseGroupsView({ players, teams }: ManageBaseGroupsViewProps) {
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const handleSave = (playerId: string, coreTeamId: string | null) => {
    startTransition(async () => {
      await updatePlayerCoreTeamAction(playerId, coreTeamId);
      setEditingPlayerId(null);
    });
  };
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-zinc-500">
        Base groups define stable team belonging. Match selections and movement are planned in rounds.
      </p>

      {teams.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8">
          <p className="text-sm text-zinc-400">No teams yet.</p>
          <Link
            href="/teams/new"
            className="text-sm font-medium text-[var(--accent-strong)] hover:underline"
          >
            Create a team first
          </Link>
        </div>
      ) : players.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8">
          <p className="text-sm text-zinc-400">No players yet.</p>
          <Link
            href="/players/new"
            className="text-sm font-medium text-[var(--accent-strong)] hover:underline"
          >
            Add player
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-soft)] bg-[var(--surface-muted)]">
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Player</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Core team</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Position</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Availability</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Flags</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  <Link
                    href="/players/new"
                    className="text-[var(--accent-strong)] hover:underline"
                  >
                    + Add
                  </Link>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)]">
              {players.map((player) => {
                const isUnavailable = player.currentAvailability !== "AVAILABLE";
                return (
                  <tr key={player.id} className={`hover:bg-[rgba(255,255,255,0.02)] transition-colors ${isUnavailable ? "bg-amber-950/5" : ""}`}>
                    <td className="px-4 py-2">
                      <Link href={`/players/${player.id}`} className="font-medium text-zinc-200 hover:text-zinc-50">
                        {player.firstName}{player.lastName ? ` ${player.lastName}` : ""}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      {editingPlayerId === player.id ? (
                        <div className="flex items-center gap-1">
                          <select
                            value={selectedTeamId}
                            onChange={(e) => setSelectedTeamId(e.target.value)}
                            className="h-7 rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-[var(--accent-strong)]"
                            disabled={isPending}
                          >
                            <option value="">Unassigned</option>
                            {teams.map((t) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleSave(player.id, selectedTeamId || null)}
                            disabled={isPending}
                            className="text-[10px] font-medium text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingPlayerId(null)}
                            disabled={isPending}
                            className="text-[10px] font-medium text-zinc-500 hover:text-zinc-300"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingPlayerId(player.id);
                            setSelectedTeamId(player.coreTeam?.id ?? "");
                          }}
                          className="text-left text-zinc-400 hover:text-zinc-200 group"
                          title="Click to change core team"
                        >
                          {player.coreTeam ? (
                            <span className="group-hover:underline">{player.coreTeam.name}</span>
                          ) : (
                            <span className="text-zinc-500 group-hover:text-zinc-400">Unassigned</span>
                          )}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2 text-zinc-300">
                      {player.primaryPosition || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className={isUnavailable ? "text-amber-300" : "text-emerald-400"}>
                        {isUnavailable ? player.currentAvailability : "Available"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        {player.nonRotatable && (
                          <span className="inline-flex items-center rounded border border-zinc-700/40 bg-zinc-800/30 px-1.5 py-0.5 text-[9px] text-zinc-400">Locked</span>
                        )}
                        {player.reducedMatchLoadAllowed && (
                          <span className="inline-flex items-center rounded border border-zinc-700/40 bg-zinc-800/30 px-1.5 py-0.5 text-[9px] text-zinc-400">RML</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/players/${player.id}`}
                        className="text-[10px] font-medium text-[var(--accent-strong)] hover:underline"
                      >
                        Profile
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}