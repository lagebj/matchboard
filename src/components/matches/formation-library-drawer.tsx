"use client";

import { useCallback, useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { TouchlineButton } from "@/components/touchline";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { formatGameFormatShort } from "@/lib/formations/types";
import type { GameFormat } from "@/generated/prisma/client";

type LibraryFormation = {
  id: string;
  name: string;
  gameFormat: string;
  source: string;
  slots: { id: string }[];
};

type FormationLibraryDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  gameFormat: GameFormat;
  currentFormationId: string | null;
  /** Applies the chosen formation to the open lineup without leaving the match. */
  onSelect: (formationId: string) => void;
  /** Where the full-page formation builder (create/edit) returns to after saving — ADR-0157
   * slice C8: the builder's slot-grid editor keeps its own route (bigger canvas than a modal
   * can reasonably host), but `returnTo` already round-trips the coach back here, so the
   * legacy `/formations` destination is never surfaced as an independent discoverability target. */
  returnTo: string;
};

/**
 * Formation library reachable from `MatchTacticsPanel` (ADR-0157 §10, "Formations in Tactics").
 * Reuses the existing formation CRUD server actions and routes verbatim -- no new formation
 * storage or system-formation logic. Replaces the former `as="a" href="/formations"` links that
 * took the coach out of the match context.
 */
export function FormationLibraryDrawer({
  isOpen,
  onClose,
  gameFormat,
  currentFormationId,
  onSelect,
  returnTo,
}: FormationLibraryDrawerProps) {
  const [formations, setFormations] = useState<LibraryFormation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(() => {
    import("@/app/(app)/rules/formation-actions").then(({ getFormationsForFormat }) =>
      getFormationsForFormat(gameFormat).then(
        (data) => setFormations(data as LibraryFormation[]),
        (e) => setError(e instanceof Error ? e.message : "Failed to load formations"),
      ),
    );
  }, [gameFormat]);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  const handleDuplicate = useCallback(
    (formationId: string) => {
      setPendingId(formationId);
      import("@/app/(app)/rules/formation-actions")
        .then(({ duplicateFormation }) => duplicateFormation(formationId))
        .then(load)
        .catch((e) => setError(e instanceof Error ? e.message : "Failed to duplicate formation"))
        .finally(() => setPendingId(null));
    },
    [load],
  );

  const handleArchive = useCallback(
    (formationId: string) => {
      setPendingId(formationId);
      import("@/app/(app)/rules/formation-actions")
        .then(({ archiveFormation }) => archiveFormation(formationId))
        .then(load)
        .catch((e) => setError(e instanceof Error ? e.message : "Failed to archive formation"))
        .finally(() => setPendingId(null));
    },
    [load],
  );

  const editHref = (formationId: string) =>
    `/formations/${formationId}/edit?returnTo=${encodeURIComponent(returnTo)}`;
  const createHref = `/formations/new?gameFormat=${gameFormat}&returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Formation library"
      description={`${formatGameFormatShort(gameFormat)} formations.`}
      size="lg"
      footer={
        <TouchlineButton variant="secondary" size="sm" as="a" href={createHref}>
          Create new formation
        </TouchlineButton>
      }
    >
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}

      {!formations ? (
        <p className="text-xs text-[var(--text-muted)]">Loading…</p>
      ) : formations.length === 0 ? (
        <EmptyState
          title="No formations for this format"
          description="Create a formation to define pitch positions and roles."
          illustration="emptyLineup"
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {formations.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-[var(--foreground)]">{f.name}</span>
                  <StatusPill variant={f.source === "SYSTEM" ? "info" : "neutral"} size="sm">
                    {f.source === "SYSTEM" ? "System" : "Custom"}
                  </StatusPill>
                  {f.id === currentFormationId && (
                    <StatusPill variant="finalized" size="sm">Current</StatusPill>
                  )}
                </div>
                <span className="text-[10px] text-[var(--text-muted)]">{f.slots.length} slots</span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <TouchlineButton
                  variant="primary"
                  size="sm"
                  disabled={f.id === currentFormationId || pendingId === f.id}
                  onClick={() => {
                    onSelect(f.id);
                    onClose();
                  }}
                >
                  Use
                </TouchlineButton>
                {f.source === "CUSTOM" && (
                  <TouchlineButton variant="ghost" size="sm" as="a" href={editHref(f.id)}>
                    Edit
                  </TouchlineButton>
                )}
                <TouchlineButton
                  variant="ghost"
                  size="sm"
                  disabled={pendingId === f.id}
                  onClick={() => handleDuplicate(f.id)}
                >
                  Duplicate
                </TouchlineButton>
                {f.source === "CUSTOM" && (
                  <TouchlineButton
                    variant="ghost"
                    size="sm"
                    disabled={pendingId === f.id}
                    className="text-[var(--danger)] hover:text-[var(--danger)]"
                    onClick={() => handleArchive(f.id)}
                  >
                    Archive
                  </TouchlineButton>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
