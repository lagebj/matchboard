"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import {
  createPlannedRotationAction,
  updatePlannedRotationAction,
  deletePlannedRotationAction,
} from "@/app/(app)/matches/planned-rotation-actions";
import type { PlannedRotationWithChanges } from "@/lib/planned-rotation/planned-rotation";

type PlannedRotationPanelProps = {
  matchId: string;
  teamId: string;
  rotation: PlannedRotationWithChanges | null;
  squadPlayers: Array<{
    id: string;
    firstName: string;
    lastName: string | null;
    primaryPosition: string;
  }>;
  readOnly?: boolean;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  APPLIED: "Applied",
  SUPERSEDED: "Superseded",
};

const CHANGE_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  APPLIED: "Applied",
  SKIPPED: "Skipped",
  MODIFIED: "Modified",
};

function formatSeconds(seconds: number | null): string {
  if (seconds === null) return "No time set";
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}'${secs.toString().padStart(2, "0")}"`;
}

function playerDisplayName(firstName: string | null, lastName: string | null): string {
  return [firstName, lastName].filter(Boolean).join(" ") || "Unknown";
}

export function PlannedRotationPanel({ matchId, teamId, rotation, squadPlayers, readOnly = false }: PlannedRotationPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const playerById = new Map(squadPlayers.map((p) => [p.id, p]));

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createPlannedRotationAction({ matchId, teamId });
      if (!result.success) {
        setError(result.error);
      }
    });
  }

  function handleDelete() {
    if (!rotation) return;
    setError(null);
    startTransition(async () => {
      const result = await deletePlannedRotationAction(rotation.id);
      if (!result.success) {
        setError(result.error);
      }
    });
  }

  function handleMoveChange(changeId: string, direction: "up" | "down") {
    if (!rotation || rotation.status !== "DRAFT") return;
    const sortedChanges = [...rotation.changes].sort((a, b) => a.sequence - b.sequence);
    const currentIndex = sortedChanges.findIndex((c) => c.id === changeId);
    if (currentIndex === -1) return;

    if (direction === "up" && currentIndex === 0) return;
    if (direction === "down" && currentIndex === sortedChanges.length - 1) return;

    const newChanges = [...sortedChanges];
    const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    [newChanges[currentIndex], newChanges[swapIndex]] = [newChanges[swapIndex], newChanges[currentIndex]];

    const updatedChanges = newChanges.map((c, i) => ({
      outPlayerId: c.outPlayerId,
      inPlayerId: c.inPlayerId,
      outPosition: c.outPosition,
      inPosition: c.inPosition,
      positionOnly: c.positionOnly,
      approximateMatchSeconds: c.approximateMatchSeconds,
      notes: c.notes,
      sequence: i + 1,
    }));

    startTransition(async () => {
      const result = await updatePlannedRotationAction(rotation.id, { changes: updatedChanges });
      if (!result.success) {
        setError(result.error);
      }
    });
  }

  const isDraft = rotation?.status === "DRAFT";

  if (!rotation) {
    return (
      <Surface padding="md">
        <SectionHeader title="Rotation plan" eyebrow="Pre-match" />
        <div className="mt-3 text-sm text-[var(--text-muted)]">
          No rotation plan yet. Create one to plan substitutions and position changes before kickoff.
        </div>
        {!readOnly && (
          <div className="mt-4">
            <Button onClick={handleCreate} disabled={isPending} size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Create rotation plan
            </Button>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-[var(--text-error)]">{error}</p>}
      </Surface>
    );
  }

  return (
    <Surface padding="md">
      <div className="flex items-center justify-between">
        <SectionHeader title="Rotation plan" eyebrow="Pre-match" />
        <StatusPill variant={rotation.status === "DRAFT" ? "neutral" : rotation.status === "APPLIED" ? "success" : "info"}>
          {STATUS_LABELS[rotation.status] ?? rotation.status}
        </StatusPill>
      </div>

      {rotation.changes.length === 0 && (
        <div className="mt-3 text-sm text-[var(--text-muted)]">
          No planned changes yet. Add substitutions or position changes to the rotation plan.
        </div>
      )}

      {rotation.changes.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {rotation.changes.map((change, index) => {
            const outPlayer = change.outPlayerId ? playerById.get(change.outPlayerId) : null;
            const inPlayer = change.inPlayerId ? playerById.get(change.inPlayerId) : null;

            return (
              <div
                key={change.id}
                className="flex items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2"
              >
                {isDraft && !readOnly && (
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => handleMoveChange(change.id, "up")}
                      disabled={isPending || index === 0}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleMoveChange(change.id, "down")}
                      disabled={isPending || index === rotation.changes.length - 1}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[var(--text-muted)]">{index + 1}.</span>
                    {change.positionOnly ? (
                      <span className="text-sm">
                        <span className="font-medium">{outPlayer ? playerDisplayName(outPlayer.firstName, change.outPlayerLastName) : "—"}</span>
                        {" ↔ "}
                        <span className="font-medium">{inPlayer ? playerDisplayName(inPlayer.firstName, change.inPlayerLastName) : "—"}</span>
                        <span className="text-[var(--text-muted)] ml-1">(position swap)</span>
                      </span>
                    ) : (
                      <span className="text-sm">
                        <span className="font-medium">{outPlayer ? playerDisplayName(change.outPlayerFirstName, change.outPlayerLastName) : "—"}</span>
                        {" out"}
                        {change.outPosition && <span className="text-[var(--text-muted)] ml-0.5">({change.outPosition})</span>}
                        {" → "}
                        <span className="font-medium">{inPlayer ? playerDisplayName(change.inPlayerFirstName, change.inPlayerLastName) : "—"}</span>
                        {" in"}
                        {change.inPosition && <span className="text-[var(--text-muted)] ml-0.5">({change.inPosition})</span>}
                      </span>
                    )}
                  </div>
                  {change.approximateMatchSeconds !== null && (
                    <div className="text-xs text-[var(--text-muted)] mt-0.5">
                      ~{formatSeconds(change.approximateMatchSeconds)}
                    </div>
                  )}
                  {change.notes && (
                    <div className="text-xs text-[var(--text-muted)] mt-0.5 italic">{change.notes}</div>
                  )}
                </div>

                <StatusPill variant="neutral" size="sm">
                  {CHANGE_STATUS_LABELS[change.status] ?? change.status}
                </StatusPill>
              </div>
            );
          })}
        </div>
      )}

      {rotation.notes && (
        <div className="mt-3 text-sm text-[var(--text-muted)] italic">{rotation.notes}</div>
      )}

      {isDraft && !readOnly && (
        <div className="mt-4 flex items-center gap-2">
          <Button onClick={handleDelete} disabled={isPending} variant="danger" size="sm">
            <Trash2 className="h-4 w-4 mr-1.5" />
            Delete plan
          </Button>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-[var(--text-error)]">{error}</p>}
    </Surface>
  );
}