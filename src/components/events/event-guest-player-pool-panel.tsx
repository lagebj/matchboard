"use client";

import { useState, useTransition } from "react";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { UserPlus } from "lucide-react";
import {
  addGuestPlayersToEventPoolAction,
  removeGuestPlayerFromEventPoolAction,
  assignGuestPlayerToEventSquadAction,
  getEventGuestPlayerPoolAction,
  getAvailableGuestPlayersForEventAction,
} from "@/app/(app)/events/event-guest-player-actions";
import { unassignPlayerFromEventSquadAction } from "@/app/(app)/events/actions";

// ADR-0106: GuestPlayer participation in one Event -- add to pool, assign/unassign to a squad,
// remove from pool. Deliberately separate from the Player pool UI above it (mirrors the
// dual-write-path pattern established at the schema/action layer) rather than retrofitting the
// existing Player-only pool table, which is already large and stateful.

type PoolEntry = {
  guestPlayerId: string;
  name: string;
  sourceLabel: string | null;
  status: string;
  eventSquadPlayerId: string | null;
  assignedSquadId: string | null;
  assignedSquadName: string | null;
};

type AvailableGuestPlayer = {
  id: string;
  name: string;
  sourceLabel: string | null;
};

export function EventGuestPlayerPoolPanel({
  eventId,
  squads,
  initialPool,
  initialAvailable,
  isFinalized,
}: {
  eventId: string;
  squads: { id: string; name: string }[];
  initialPool: PoolEntry[];
  initialAvailable: AvailableGuestPlayer[];
  isFinalized: boolean;
}) {
  const [pool, setPool] = useState<PoolEntry[]>(initialPool);
  const [available, setAvailable] = useState<AvailableGuestPlayer[]>(initialAvailable);
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
  const [assignSquadByGuestId, setAssignSquadByGuestId] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = () => {
    startTransition(async () => {
      const [nextPool, nextAvailable] = await Promise.all([
        getEventGuestPlayerPoolAction(eventId),
        getAvailableGuestPlayersForEventAction(eventId),
      ]);
      setPool(nextPool);
      setAvailable(nextAvailable);
    });
  };

  const handleAdd = () => {
    if (selectedToAdd.size === 0) return;
    setError(null);
    startTransition(async () => {
      try {
        await addGuestPlayersToEventPoolAction(eventId, [...selectedToAdd]);
        setSelectedToAdd(new Set());
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add guest players to pool.");
      }
    });
  };

  const handleRemove = (guestPlayerId: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await removeGuestPlayerFromEventPoolAction(eventId, guestPlayerId);
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to remove guest player from pool.");
      }
    });
  };

  const handleAssign = (guestPlayerId: string) => {
    const squadId = assignSquadByGuestId[guestPlayerId];
    if (!squadId) return;
    setError(null);
    startTransition(async () => {
      try {
        await assignGuestPlayerToEventSquadAction(eventId, squadId, guestPlayerId);
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to assign guest player to squad.");
      }
    });
  };

  const handleUnassign = (eventSquadPlayerId: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await unassignPlayerFromEventSquadAction(eventSquadPlayerId);
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to unassign guest player.");
      }
    });
  };

  return (
    <Surface variant="default" padding="md">
      <SectionHeader
        title="Guest players"
        description="Reusable external players for this Event, drawn from this Event's Group. Not tracked long-term."
      />

      {error && (
        <p className="mt-2 text-xs text-red-500" role="alert">
          {error}
        </p>
      )}

      {available.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-[var(--text-muted)]">
            Add a guest player from this Group to this Event&apos;s pool.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {available.map((g) => (
              <label
                key={g.id}
                className="flex items-center gap-1.5 rounded-md border border-[var(--border-soft)] px-2 py-1 text-xs text-zinc-100"
              >
                <input
                  type="checkbox"
                  checked={selectedToAdd.has(g.id)}
                  disabled={isFinalized || pending}
                  onChange={() => {
                    const next = new Set(selectedToAdd);
                    if (next.has(g.id)) next.delete(g.id);
                    else next.add(g.id);
                    setSelectedToAdd(next);
                  }}
                />
                {g.name}
                {g.sourceLabel && <span className="text-[var(--text-muted)]">({g.sourceLabel})</span>}
              </label>
            ))}
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="mt-2"
            onClick={handleAdd}
            disabled={isFinalized || pending || selectedToAdd.size === 0}
          >
            <UserPlus className="mr-1 h-4 w-4" />
            Add {selectedToAdd.size > 0 ? selectedToAdd.size : ""} to pool
          </Button>
        </div>
      )}

      {pool.length === 0 ? (
        <p className="mt-3 text-xs text-[var(--text-muted)]">No guest players in this Event&apos;s pool yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-soft)]">
                <th className="text-left py-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Guest player</th>
                <th className="text-left py-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Squad</th>
                <th className="text-left py-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pool.map((g) => (
                <tr key={g.guestPlayerId} className="border-b border-[var(--border-soft)]/50 hover:bg-[var(--surface-hover)]">
                  <td className="py-2 px-2 text-zinc-100">
                    {g.name}
                    {g.sourceLabel && <span className="ml-1 text-[var(--text-muted)]">({g.sourceLabel})</span>}
                  </td>
                  <td className="py-2 px-2 text-[var(--text-soft)]">{g.assignedSquadName ?? "—"}</td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      {g.assignedSquadId && g.eventSquadPlayerId ? (
                        <button
                          onClick={() => handleUnassign(g.eventSquadPlayerId!)}
                          className="text-[10px] text-[var(--danger)] hover:underline disabled:opacity-50"
                          disabled={isFinalized || pending}
                        >
                          Unassign
                        </button>
                      ) : (
                        <>
                          <select
                            className="text-xs bg-[var(--surface-base)] border border-[var(--border-soft)] rounded px-1.5 py-0.5 disabled:opacity-50"
                            value={assignSquadByGuestId[g.guestPlayerId] ?? ""}
                            onChange={(e) =>
                              setAssignSquadByGuestId((prev) => ({ ...prev, [g.guestPlayerId]: e.target.value }))
                            }
                            disabled={isFinalized || pending}
                          >
                            <option value="">Select squad…</option>
                            {squads.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleAssign(g.guestPlayerId)}
                            className="text-[10px] text-[var(--accent)] hover:underline disabled:opacity-50"
                            disabled={isFinalized || pending || !assignSquadByGuestId[g.guestPlayerId]}
                          >
                            Assign
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleRemove(g.guestPlayerId)}
                        className="text-[10px] text-[var(--danger)] hover:underline disabled:opacity-50"
                        title="Remove from pool"
                        disabled={isFinalized || pending}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Surface>
  );
}
