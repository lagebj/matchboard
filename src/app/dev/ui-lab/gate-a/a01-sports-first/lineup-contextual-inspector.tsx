"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { LineupList } from "./lineup-list";
import type { LineupPreviewEntry } from "./fixtures";

/**
 * `LineupContextualInspector` — A01 final correction (PR #777). Desktop presentation of the
 * "Lineup" action: an inline secondary panel beside the match, never a full-width overlay.
 *
 * Deliberately NOT built on the shared `TouchlineInspector`/`PlayerContextHeader` primitives —
 * those are explicitly a *selected-player* identity block (`PlayerContextHeader` renders a
 * `PitchPlayerToken`, i.e. a shirt, for one player's name/number). Forcing a match-lineup list
 * through a single-player header would misrepresent what's being shown. This is a small, isolated
 * UI Lab composition built from the same generic surface/border/radius/typography tokens instead
 * (`13_UI_LAB_AND_GOLDEN_GATE.md` naming), matching the F6 study's "contextual inspector beside
 * the football object" pattern without inventing a new drawer framework.
 *
 * Same `LineupList` component and the same fixture data as the mobile bottom sheet — one source
 * of truth, two responsive presentations.
 */
type Props = {
  matchReference: string;
  entries: LineupPreviewEntry[];
  onClose: () => void;
  className?: string;
};

export function LineupContextualInspector({ matchReference, entries, onClose, className }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside
      aria-label="Lineup inspector"
      role="dialog"
      aria-modal="false"
      className={cn(
        "flex w-full flex-col gap-4 rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] p-4 shadow-[var(--tl-widget-shadow)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Lineup</p>
          <p className="mt-0.5 truncate text-[13px] font-medium text-[var(--foreground)]">{matchReference}</p>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--tl-c-surface-hover)] hover:text-[var(--foreground)]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <p className="text-[11px] text-[var(--text-muted)]">Read-only — stays in this match context. No production mutation.</p>

      <LineupList entries={entries} />
    </aside>
  );
}
