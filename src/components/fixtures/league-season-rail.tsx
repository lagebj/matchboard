"use client";

import { useEffect, useRef, useState } from "react";
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
 *
 * The rail only ever occupies the width available to it (never the page): it measures its own
 * container and renders a symmetric window of slots around the current/selected week so the
 * season's full week list never forces page-level horizontal scroll. A thin connecting line runs
 * behind the markers so the visible rounds read as one continuous timeline.
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

// Approximate rendered width (min slot width + gap) used to size the visible window to the
// container's available viewport width rather than the full season length.
const SLOT_WIDTH_PX = 76;
const MIN_VISIBLE_SLOTS = 3;

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

function centerIndexOf(slots: LeagueRailSlot[]): number {
  const selectedIndex = slots.findIndex((s) => s.selected);
  if (selectedIndex >= 0) return selectedIndex;
  const currentIndex = slots.findIndex((s) => s.state === "CURRENT");
  if (currentIndex >= 0) return currentIndex;
  return Math.floor(slots.length / 2);
}

/** Slice `slots` to a symmetric window of `visibleCount` entries centred on `centerIndex`. */
function windowSlots(
  slots: LeagueRailSlot[],
  centerIndex: number,
  visibleCount: number,
): LeagueRailSlot[] {
  if (slots.length <= visibleCount) return slots;
  const half = Math.floor(visibleCount / 2);
  let start = centerIndex - half;
  let end = start + visibleCount;
  if (start < 0) {
    end -= start;
    start = 0;
  }
  if (end > slots.length) {
    start -= end - slots.length;
    end = slots.length;
  }
  start = Math.max(0, start);
  return slots.slice(start, end);
}

export function LeagueSeasonRail({ slots, onSelect, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement | HTMLButtonElement | null>(null);
  const [visibleCount, setVisibleCount] = useState(MIN_VISIBLE_SLOTS);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? el.clientWidth;
      const fit = Math.floor(width / SLOT_WIDTH_PX);
      setVisibleCount(Math.max(MIN_VISIBLE_SLOTS, fit));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const centerIndex = centerIndexOf(slots);
  const visibleSlots = windowSlots(slots, centerIndex, visibleCount);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "auto" });
    // Re-run whenever the visible slot window/selection changes (phase switch, round selection).
  }, [visibleSlots]);

  return (
    <div
      ref={containerRef}
      role="list"
      aria-label="League season weeks"
      className={cn(
        "relative flex min-w-0 max-w-full gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]",
        className,
      )}
    >
      {visibleSlots.map((slot, index) => {
        const isInteractive = slot.state !== "EMPTY" && slot.primaryRoundId != null;
        const isMarked = slot.selected || slot.state === "CURRENT";
        const isFirst = index === 0;
        const isLast = index === visibleSlots.length - 1;
        const content = (
          <>
            {/* Connecting line behind the marker, joining this slot to its neighbours so the
                visible window reads as one continuous timeline. */}
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute top-[19px] h-px bg-[var(--border-soft)]",
                isFirst ? "left-1/2" : "-left-1.5",
                isLast ? "right-1/2" : "-right-1.5",
              )}
            />
            <span
              aria-hidden="true"
              className={cn(
                "relative h-3 w-3 rounded-full",
                markerClassName(slot.state, slot.selected),
              )}
            />
            <span className="relative text-[11px] font-semibold tabular-nums text-[var(--text-soft)]">
              {slot.weekLabel}
            </span>
            <span
              className={cn(
                "relative text-[10px] font-medium uppercase tracking-[0.06em]",
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
              className="relative flex min-w-[64px] shrink-0 flex-col items-center gap-1 rounded-[var(--tl-c-radius-control)] px-2 py-2 opacity-50"
            >
              {content}
            </div>
          );
        }

        return (
          <div key={slot.weekKey} role="listitem" className="relative shrink-0">
            <button
              type="button"
              ref={isMarked ? (el) => { activeRef.current = el; } : undefined}
              onClick={() => onSelect(slot.primaryRoundId as string)}
              aria-current={slot.selected ? "true" : undefined}
              aria-label={`${slot.weekLabel} — ${STATE_LABEL[slot.state]}`}
              className={cn(
                "relative flex min-h-[44px] min-w-[64px] flex-col items-center gap-1 rounded-[var(--tl-c-radius-control)] px-2 py-2 transition-colors hover:bg-[var(--tl-c-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]",
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
