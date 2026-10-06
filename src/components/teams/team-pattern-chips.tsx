"use client";

import { useId, useState } from "react";
import type { PatternChipViewModel } from "@/lib/team-season-profile/presentation";

/**
 * Compact, deterministic Teams-overview pattern chips (ADR-0156 §08). At most 2, already
 * ranked/selected by the caller via `selectTopPatternKeys()` -- this component never ranks,
 * compares teams, or renders AI prose, only the short label the caller supplies plus an
 * accessible disclosure of its one evidence sentence.
 *
 * The evidence line is a same-page disclosure (a real `<button>` toggling a sibling note), not
 * a `title`-attribute tooltip or a floating popover library -- this is reachable and operable
 * by keyboard alone (Tab + Enter/Space), which a hover-only tooltip is not (Test plan K.4).
 */
export function TeamPatternChips({ chips }: { chips: PatternChipViewModel[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <PatternChip key={chip.key} chip={chip} isOpen={openKey === chip.key} onToggle={() => setOpenKey((current) => (current === chip.key ? null : chip.key))} />
      ))}
    </div>
  );
}

function PatternChip({ chip, isOpen, onToggle }: { chip: PatternChipViewModel; isOpen: boolean; onToggle: () => void }) {
  const noteId = useId();

  return (
    <div className="relative inline-block">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={noteId}
        onClick={onToggle}
        className="inline-flex items-center rounded-md border border-[var(--border-soft)] bg-[var(--surface-muted)]/60 px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-soft)] hover:border-[var(--accent)]/40 hover:text-[var(--foreground)]"
      >
        {chip.shortLabel}
      </button>
      {isOpen && (
        <div
          id={noteId}
          role="note"
          className="absolute left-0 top-full z-10 mt-1 w-56 rounded-md border border-[var(--border-soft)] bg-[var(--surface-base)] p-2 text-[11px] leading-snug text-[var(--text-soft)] shadow-lg"
        >
          {chip.evidenceSentence}
        </div>
      )}
    </div>
  );
}
