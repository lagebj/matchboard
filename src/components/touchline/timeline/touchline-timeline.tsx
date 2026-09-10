import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * TouchlineTimeline (bundle `07_TEMPORAL_AND_EVENT_GRAMMAR.md §3`,
 * `12_COMPONENT_CONTRACTS.md §9`).
 *
 * Time is a visual structure — a time column, a low-contrast rail with nodes, a
 * content lane. Used on Today and Event detail. Compact geometry: 52 px time
 * column, 12 px gutter, 18 px node column, content after. Current/next node =
 * accent; live node = live colour; finished nodes muted. Node state must be
 * legible without colour alone (size + fill differ per state).
 */
export type TimelineNodeState = "done" | "current" | "next" | "live" | "later";

const nodeClass: Record<TimelineNodeState, string> = {
  done: "h-1.5 w-1.5 bg-[var(--border-strong)]",
  later: "h-2 w-2 bg-[var(--border-strong)]",
  next: "h-2.5 w-2.5 border-2 border-[var(--accent)] bg-[var(--tl-c-canvas)]",
  current: "h-2.5 w-2.5 bg-[var(--accent)] ring-4 ring-[var(--accent-subtle)]",
  live: "h-2.5 w-2.5 bg-[var(--tl-c-live)] ring-4 ring-[var(--tl-c-live-subtle)]",
};

export function TouchlineTimeline({
  children,
  className,
  "aria-label": ariaLabel = "Timeline",
}: {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <ol aria-label={ariaLabel} className={cn("flex flex-col", className)}>
      {children}
    </ol>
  );
}

type ItemProps = {
  /** "17:30" for a timed item; omit for untimed work (never fake a clock time). */
  timeLabel?: string | null;
  state: TimelineNodeState;
  /** Short uppercase orientation label above the content, e.g. "NEXT". */
  kicker?: string | null;
  /** Wrap the content in a subtle bordered box (the selected / needs-attention item). */
  highlighted?: boolean;
  isLast?: boolean;
  children: ReactNode;
  className?: string;
};

export function TimelineItem({
  timeLabel,
  state,
  kicker,
  highlighted = false,
  isLast = false,
  children,
  className,
}: ItemProps) {
  return (
    <li className={cn("relative flex gap-3 py-2.5", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-0 left-[4rem] w-px bg-[var(--border-soft)]",
          isLast ? "h-7" : "bottom-0",
        )}
      />
      <span className="w-[3.5rem] shrink-0 whitespace-nowrap pt-1 text-right text-[11px] tabular-nums text-[var(--text-muted)]">
        {timeLabel ?? ""}
      </span>
      <span className="relative z-10 flex w-2.5 shrink-0 justify-center pt-[0.6rem]">
        <span className={cn("rounded-full", nodeClass[state])} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 pl-1">
        {kicker ? (
          <p
            className={cn(
              "mb-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
              state === "current" || state === "next"
                ? "text-[var(--accent)]"
                : state === "live"
                  ? "text-[var(--tl-c-live)]"
                  : "text-[var(--text-muted)]",
            )}
          >
            {kicker}
          </p>
        ) : null}
        <div
          className={cn(
            highlighted &&
              "rounded-[var(--tl-c-radius-object)] border border-[color-mix(in_srgb,var(--accent)_35%,var(--border-strong))] bg-[var(--tl-c-surface-hover)] px-3 py-2.5",
          )}
        >
          {children}
        </div>
      </div>
    </li>
  );
}
