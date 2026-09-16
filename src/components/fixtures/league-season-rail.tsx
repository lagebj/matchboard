"use client";

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import type { LeagueRailSlot, LeagueRailSlotState } from "@/lib/touchline/presentation/league-view-model";

/**
 * LeagueSeasonRail — League Operating Surface (`06_COMPONENT_COMPOSITION_CONTRACT.md`,
 * `02_ROUND_TEMPORAL_AND_OPERATIONAL_MODEL.md`).
 *
 * A horizontal, week-based temporal line across the selected league phase. Renders slots exactly
 * as computed by `buildLeagueOperatingViewModel()` — no domain computation happens here. Empty
 * calendar weeks are rendered but not interactive. State is distinguished by both a marker glyph
 * and a text label, never colour alone.
 *
 * The full League phase is rendered on one contained horizontal timeline — every week slot is
 * always in the DOM and reachable by scroll, desktop mouse wheel, touch swipe, or keyboard. The
 * rail never widens its ancestors (`min-w-0`/`max-w-full`/`overflow-x-auto` on the scroll
 * viewport only; the timeline track itself is `w-max`), and its viewport scrolls independently of
 * the page. The native scrollbar is hidden while scrolling itself remains fully functional; subtle
 * edge fades hint that more of the season is off-screen. The current/selected slot is centred
 * inside the rail viewport on mount/selection change (never via `scrollIntoView`, which could
 * otherwise scroll the page). A single continuous connector line, geometrically anchored to the
 * first and last marker's measured centres, runs behind every marker.
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

// Sub-pixel/rounding tolerance used when deciding whether the rail can still move in a given
// direction (scroll boundary comparisons).
const SCROLL_EPSILON_PX = 1;

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

/** Indices of every interactive (non-empty) slot, in rail order — used for arrow-key navigation. */
function interactiveIndices(slots: LeagueRailSlot[]): number[] {
  const indices: number[] = [];
  slots.forEach((slot, index) => {
    if (slot.state !== "EMPTY" && slot.primaryRoundId != null) indices.push(index);
  });
  return indices;
}

export function LeagueSeasonRail({ slots, onSelect, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement | HTMLButtonElement | null>(null);
  const firstMarkerRef = useRef<HTMLSpanElement | null>(null);
  const lastMarkerRef = useRef<HTMLSpanElement | null>(null);
  const buttonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const [connector, setConnector] = useState<{ left: number; width: number; top: number } | null>(null);
  const [edge, setEdge] = useState({ left: false, right: false });

  // Auto-centre the selected/current week inside the rail viewport only. This never touches page
  // scroll — it computes a rail-local target from measured offsets and calls `scrollTo`/sets
  // `scrollLeft` on the rail's own scroll container, not `scrollIntoView` on the element.
  useLayoutEffect(() => {
    const container = containerRef.current;
    const active = activeRef.current;
    if (!container || !active) return;
    const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
    const itemCenter = active.offsetLeft + active.offsetWidth / 2;
    const viewportCenter = container.clientWidth / 2;
    const target = Math.min(Math.max(itemCenter - viewportCenter, 0), maxScroll);
    if (typeof container.scrollTo === "function") {
      container.scrollTo({ left: target, behavior: "auto" });
    } else {
      container.scrollLeft = target;
    }
  }, [slots]);

  // Measure the continuous connector so it starts/ends exactly at the first/last marker's centre,
  // regardless of slot count or content-driven slot width — geometry, not pixel assumptions.
  useLayoutEffect(() => {
    const track = trackRef.current;
    const first = firstMarkerRef.current;
    const last = lastMarkerRef.current;
    if (!track || !first || !last) {
      setConnector(null);
      return;
    }
    const recompute = () => {
      const trackRect = track.getBoundingClientRect();
      const firstRect = first.getBoundingClientRect();
      const lastRect = last.getBoundingClientRect();
      const left = firstRect.left + firstRect.width / 2 - trackRect.left;
      const right = lastRect.left + lastRect.width / 2 - trackRect.left;
      const top = firstRect.top + firstRect.height / 2 - trackRect.top;
      setConnector({ left, width: Math.max(0, right - left), top });
    };
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [slots]);

  // Subtle edge-fade affordance: visible only while more timeline exists off-screen in that
  // direction. Recomputed on scroll and on resize.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      setEdge({
        left: el.scrollLeft > SCROLL_EPSILON_PX,
        right: el.scrollLeft < maxScroll - SCROLL_EPSILON_PX,
      });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [slots]);

  // Desktop mouse wheel "winds" the rail horizontally, like a film wheel. Falls through to
  // ordinary page scroll once the rail has reached the relevant boundary — the user is never
  // trapped. Attached as a native (non-passive) listener so `preventDefault()` is honoured; React's
  // synthetic wheel handler is passive by default.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (event: WheelEvent) => {
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (delta === 0) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      const canMoveLeft = delta < 0 && el.scrollLeft > SCROLL_EPSILON_PX;
      const canMoveRight = delta > 0 && el.scrollLeft < maxScroll - SCROLL_EPSILON_PX;
      if (!canMoveLeft && !canMoveRight) return;
      event.preventDefault();
      el.scrollLeft += delta;
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  const interactive = interactiveIndices(slots);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, slotIndex: number) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const position = interactive.indexOf(slotIndex);
    if (position < 0) return;
    const nextPosition = event.key === "ArrowRight" ? position + 1 : position - 1;
    const nextIndex = interactive[nextPosition];
    if (nextIndex == null) return;
    event.preventDefault();
    buttonRefs.current.get(nextIndex)?.focus();
  }

  return (
    <div className={cn("relative min-w-0 max-w-full", className)}>
      <div
        ref={containerRef}
        role="list"
        aria-label="League season weeks"
        className={cn(
          "relative min-w-0 max-w-full overflow-x-auto overflow-y-hidden pb-1",
          "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
          "[scroll-snap-type:x_proximity]",
        )}
      >
        <div ref={trackRef} className="relative flex w-max min-w-full items-start gap-3 px-1">
          {connector ? (
            <span
              aria-hidden="true"
              data-testid="league-season-connector"
              className="pointer-events-none absolute h-px -translate-y-1/2 bg-[var(--border-soft)]"
              style={{ left: connector.left, width: connector.width, top: connector.top }}
            />
          ) : null}
          {slots.map((slot, index) => {
            const isInteractive = slot.state !== "EMPTY" && slot.primaryRoundId != null;
            const isMarked = slot.selected || slot.state === "CURRENT";
            const isFirst = index === 0;
            const isLast = index === slots.length - 1;

            const content = (
              <>
                <div className="relative flex h-4 w-full items-center justify-center">
                  <span
                    ref={(el) => {
                      if (isFirst) firstMarkerRef.current = el;
                      if (isLast) lastMarkerRef.current = el;
                    }}
                    aria-hidden="true"
                    className={cn("relative z-10 h-3 w-3 rounded-full", markerClassName(slot.state, slot.selected))}
                  />
                </div>
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
                  style={{ scrollSnapAlign: "center" }}
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
                  ref={(el) => {
                    if (el) buttonRefs.current.set(index, el);
                    else buttonRefs.current.delete(index);
                    if (isMarked) activeRef.current = el;
                  }}
                  onClick={() => onSelect(slot.primaryRoundId as string)}
                  onKeyDown={(event) => handleKeyDown(event, index)}
                  aria-current={slot.selected ? "true" : undefined}
                  aria-label={`${slot.weekLabel} — ${STATE_LABEL[slot.state]}`}
                  style={{ scrollSnapAlign: "center" }}
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
      </div>
      <span
        aria-hidden="true"
        data-testid="league-season-edge-fade-left"
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[var(--tl-c-canvas)] to-transparent transition-opacity duration-150",
          edge.left ? "opacity-100" : "opacity-0",
        )}
      />
      <span
        aria-hidden="true"
        data-testid="league-season-edge-fade-right"
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[var(--tl-c-canvas)] to-transparent transition-opacity duration-150",
          edge.right ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
