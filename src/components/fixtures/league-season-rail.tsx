"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import type { LeagueRailSlot, LeagueRailSlotState } from "@/lib/touchline/presentation/league-view-model";

/**
 * LeagueSeasonRail — League Operating Surface (`06_COMPONENT_COMPOSITION_CONTRACT.md`,
 * `02_ROUND_TEMPORAL_AND_OPERATIONAL_MODEL.md`).
 *
 * A horizontal, week-based temporal line across the selected league phase. Renders slots exactly
 * as computed by `buildLeagueOperatingViewModel()` — no domain computation happens here. Empty
 * calendar weeks are rendered but not interactive. State is distinguished by both a marker glyph
 * and a text label, never colour alone. The current/selected slot auto-scrolls into view.
 */
type Props = {
  slots: LeagueRailSlot[];
  onSelect: (roundId: string) => void;
  className?: string;
};

const STATE_LABEL: Record<LeagueRailSlotState, string> = {
  EMPTY: "—",
  FINAL: "Final",
  NEEDS_CLOSURE: "Needs closure",
  CURRENT: "Current",
  ATTENTION: "Attention",
  UPCOMING: "Upcoming",
};

function markerClassName(state: LeagueRailSlotState, selected: boolean): string {
  switch (state) {
    case "EMPTY":
      return "border border-dashed border-[var(--border-soft)]";
    case "FINAL":
      return "border border-[var(--border-soft)] bg-[var(--tl-c-surface-strong)]";
    case "NEEDS_CLOSURE":
      return "border-2 border-[var(--warning)] bg-[var(--tl-c-surface)]";
    case "CURRENT":
      return cn(
        "border-2 border-[var(--tl-c-live)] bg-[var(--tl-c-surface)]",
        selected && "shadow-[0_0_0_3px_var(--tl-c-live)]",
      );
    case "ATTENTION":
      return "border-2 border-[var(--warning)] bg-[var(--tl-c-surface)]";
    case "UPCOMING":
      return "border border-[var(--border-soft)] bg-[var(--tl-c-surface)]";
  }
}

export function LeagueSeasonRail({ slots, onSelect, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement | HTMLButtonElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "auto" });
    // Re-run whenever the slot set/selection changes (phase switch, round selection).
  }, [slots]);

  return (
    <div
      ref={containerRef}
      role="list"
      aria-label="League season weeks"
      className={cn("flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]", className)}
    >
      {slots.map((slot) => {
        const isInteractive = slot.state !== "EMPTY" && slot.primaryRoundId != null;
        const isMarked = slot.selected || slot.state === "CURRENT";
        const content = (
          <>
            <span
              aria-hidden="true"
              className={cn("h-3 w-3 rounded-full", markerClassName(slot.state, slot.selected))}
            />
            <span className="text-[11px] font-semibold tabular-nums text-[var(--text-soft)]">
              {slot.weekLabel}
            </span>
            <span
              className={cn(
                "text-[10px] font-medium uppercase tracking-[0.06em]",
                slot.state === "NEEDS_CLOSURE" || slot.state === "ATTENTION"
                  ? "text-[var(--warning)]"
                  : slot.state === "CURRENT"
                    ? "text-[var(--tl-c-live)]"
                    : "text-[var(--text-muted)]",
              )}
            >
              {STATE_LABEL[slot.state]}
            </span>
          </>
        );

        if (!isInteractive) {
          return (
            <div
              key={slot.weekKey}
              role="listitem"
              aria-disabled="true"
              className="flex min-w-[64px] shrink-0 flex-col items-center gap-1 rounded-[var(--tl-c-radius-control)] px-2 py-2 opacity-50"
            >
              {content}
            </div>
          );
        }

        return (
          <div key={slot.weekKey} role="listitem" className="shrink-0">
            <button
              type="button"
              ref={isMarked ? (el) => { activeRef.current = el; } : undefined}
              onClick={() => onSelect(slot.primaryRoundId as string)}
              aria-current={slot.selected ? "true" : undefined}
              aria-label={`${slot.weekLabel} — ${STATE_LABEL[slot.state]}`}
              className={cn(
                "flex min-h-[44px] min-w-[64px] flex-col items-center gap-1 rounded-[var(--tl-c-radius-control)] px-2 py-2 transition-colors hover:bg-[var(--tl-c-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]",
                slot.selected && "bg-[var(--tl-c-surface-hover)]",
              )}
            >
              {content}
            </button>
          </div>
        );
      })}
    </div>
  );
}
