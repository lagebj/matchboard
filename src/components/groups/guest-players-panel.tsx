"use client";

import { useState, useTransition } from "react";
import { Surface } from "@/components/ui/surface";
import { TouchlineButton } from "@/components/touchline";
import { SectionHeader } from "@/components/ui/section-header";
import { UserPlus, Pencil, RotateCcw, Ban } from "lucide-react";
import {
  createGuestPlayerAction,
  updateGuestPlayerAction,
  setGuestPlayerActiveAction,
  getGroupGuestPlayersAction,
} from "@/app/(app)/groups/guest-player-actions";
import {
  GUEST_PLAYER_NAME_MAX_LENGTH,
  GUEST_PLAYER_SOURCE_LABEL_MAX_LENGTH,
  GUEST_PLAYER_NOTE_MAX_LENGTH,
} from "@/lib/guest-players/guest-player-constants";

// ADR-0106: Guest player pool management for one Group. Mirrors TeamFocusPanel's local-state +
// server-action-refresh pattern. Creation form is Name + Source only, per the required
// terminology table ("Guest player", "Add guest player", "Edit guest player", "Deactivate",
// "Reactivate", "Source").

type GuestPlayerRow = {
  id: string;
  footballGroupId: string;
  name: string;
  sourceLabel: string | null;
  note: string | null;
  active: boolean;
  deactivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function toRow(g: {
  id: string;
  footballGroupId: string;
  name: string;
  sourceLabel: string | null;
  note: string | null;
  active: boolean;
  deactivatedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}): GuestPlayerRow {
  return {
    ...g,
    deactivatedAt: g.deactivatedAt ? new Date(g.deactivatedAt).toISOString() : null,
    createdAt: new Date(g.createdAt).toISOString(),
    updatedAt: new Date(g.updatedAt).toISOString(),
  };
}

export function GuestPlayersPanel({
  groupSlugOrId,
  initialGuestPlayers,
}: {
  groupSlugOrId: string;
  initialGuestPlayers: Array<{
    id: string;
    footballGroupId: string;
    name: string;
    sourceLabel: string | null;
    note: string | null;
    active: boolean;
    deactivatedAt: Date | string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
  }>;
}) {
  const [guestPlayers, setGuestPlayers] = useState<GuestPlayerRow[]>(initialGuestPlayers.map(toRow));
  const [includeInactive, setIncludeInactive] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newSourceLabel, setNewSourceLabel] = useState("");
  const [newNote, setNewNote] = useState("");
  const [editName, setEditName] = useState("");
  const [editSourceLabel, setEditSourceLabel] = useState("");
  const [editNote, setEditNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = (nextIncludeInactive = includeInactive) => {
    startTransition(async () => {
      const result = await getGroupGuestPlayersAction(groupSlugOrId, nextIncludeInactive);
      setGuestPlayers(result.map(toRow));
    });
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("name", newName.trim());
      if (newSourceLabel.trim()) formData.set("sourceLabel", newSourceLabel.trim());
      if (newNote.trim()) formData.set("note", newNote.trim());

      const result = await createGuestPlayerAction(groupSlugOrId, formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setAdding(false);
      setNewName("");
      setNewSourceLabel("");
      setNewNote("");
      refresh();
    });
  };

  const handleEdit = (guestPlayerId: string) => {
    if (!editName.trim()) return;
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("name", editName.trim());
      formData.set("sourceLabel", editSourceLabel.trim());
      formData.set("note", editNote.trim());

      const result = await updateGuestPlayerAction(guestPlayerId, formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setEditingId(null);
      refresh();
    });
  };

  const handleToggleActive = (guestPlayerId: string, active: boolean) => {
    setError(null);
    startTransition(async () => {
      const result = await setGuestPlayerActiveAction(guestPlayerId, active);
      if (!result.success) {
        setError(result.error);
        return;
      }
      refresh();
    });
  };

  const activeGuestPlayers = guestPlayers.filter((g) => g.active);
  const inactiveGuestPlayers = guestPlayers.filter((g) => !g.active);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeader
          title="Guest players"
          description="Reusable external players for this Group's Events and League Rounds. Not tracked long-term."
        />
        <TouchlineButton
          size="sm"
          variant="secondary"
          onClick={() => {
            setAdding(true);
            setNewName("");
            setNewSourceLabel("");
            setNewNote("");
            setError(null);
          }}
          disabled={adding || pending}
        >
          <UserPlus className="mr-1 h-4 w-4" />
          Add guest player
        </TouchlineButton>
      </div>

      {error && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}

      {activeGuestPlayers.length === 0 && !adding && (
        <p className="text-sm text-[var(--text-muted)]">
          No guest players yet. Add a guest player to include an external player in an Event or League Round.
        </p>
      )}

      {adding && (
        <Surface variant="raised" padding="md" className="space-y-3">
          <div>
            <label className="text-sm font-medium">Name</label>
            <input
              type="text"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="e.g. Oliver Hansen"
              maxLength={GUEST_PLAYER_NAME_MAX_LENGTH}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={pending}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Source (optional)</label>
            <input
              type="text"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="e.g. G2016"
              maxLength={GUEST_PLAYER_SOURCE_LABEL_MAX_LENGTH}
              value={newSourceLabel}
              onChange={(e) => setNewSourceLabel(e.target.value)}
              disabled={pending}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Note (optional)</label>
            <textarea
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              maxLength={GUEST_PLAYER_NOTE_MAX_LENGTH}
              rows={2}
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="flex gap-2">
            <TouchlineButton size="sm" onClick={handleCreate} disabled={pending || !newName.trim()}>
              Save
            </TouchlineButton>
            <TouchlineButton size="sm" variant="ghost" onClick={() => setAdding(false)} disabled={pending}>
              Cancel
            </TouchlineButton>
          </div>
        </Surface>
      )}

      {activeGuestPlayers.map((guestPlayer) => (
        <Surface key={guestPlayer.id} variant="raised" padding="md">
          {editingId === guestPlayer.id ? (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Name</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  maxLength={GUEST_PLAYER_NAME_MAX_LENGTH}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={pending}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Source (optional)</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  maxLength={GUEST_PLAYER_SOURCE_LABEL_MAX_LENGTH}
                  value={editSourceLabel}
                  onChange={(e) => setEditSourceLabel(e.target.value)}
                  disabled={pending}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Note (optional)</label>
                <textarea
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  maxLength={GUEST_PLAYER_NOTE_MAX_LENGTH}
                  rows={2}
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="flex gap-2">
                <TouchlineButton size="sm" onClick={() => handleEdit(guestPlayer.id)} disabled={pending || !editName.trim()}>
                  Save
                </TouchlineButton>
                <TouchlineButton size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={pending}>
                  Cancel
                </TouchlineButton>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{guestPlayer.name}</span>
                  {guestPlayer.sourceLabel && (
                    <span className="inline-flex items-center rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                      {guestPlayer.sourceLabel}
                    </span>
                  )}
                </div>
                {guestPlayer.note && (
                  <p className="mt-1 text-sm text-[var(--text-muted)]">{guestPlayer.note}</p>
                )}
              </div>
              <div className="flex gap-1">
                <TouchlineButton
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(guestPlayer.id);
                    setEditName(guestPlayer.name);
                    setEditSourceLabel(guestPlayer.sourceLabel ?? "");
                    setEditNote(guestPlayer.note ?? "");
                    setError(null);
                  }}
                  disabled={pending}
                  title="Edit guest player"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </TouchlineButton>
                <TouchlineButton
                  size="sm"
                  variant="ghost"
                  onClick={() => handleToggleActive(guestPlayer.id, false)}
                  disabled={pending}
                  title="Deactivate"
                >
                  <Ban className="h-3.5 w-3.5 text-gray-500" />
                </TouchlineButton>
              </div>
            </div>
          )}
        </Surface>
      ))}

      {(inactiveGuestPlayers.length > 0 || includeInactive) && (
        <details
          className="group"
          open={includeInactive}
          onToggle={(e) => {
            const isOpen = (e.target as HTMLDetailsElement).open;
            setIncludeInactive(isOpen);
            if (isOpen) refresh(true);
          }}
        >
          <summary className="cursor-pointer text-sm font-medium text-[var(--text-muted)] hover:text-[var(--foreground)]">
            Inactive guest players
          </summary>
          <div className="mt-2 space-y-2">
            {inactiveGuestPlayers.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No inactive guest players.</p>
            ) : (
              inactiveGuestPlayers.map((guestPlayer) => (
                <Surface key={guestPlayer.id} variant="subtle" padding="sm">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <span className="text-sm">{guestPlayer.name}</span>
                      {guestPlayer.sourceLabel && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                          {guestPlayer.sourceLabel}
                        </span>
                      )}
                    </div>
                    <TouchlineButton
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleActive(guestPlayer.id, true)}
                      disabled={pending}
                      title="Reactivate"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </TouchlineButton>
                  </div>
                </Surface>
              ))
            )}
          </div>
        </details>
      )}
    </div>
  );
}
