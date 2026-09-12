import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Operational Timeline — the one canonical chronological rail (ADR-0125,
 * `.matchboard-work/matchboard-reference-convergence-programme/02_STRUCTURED_TIMELINE_SPEC.md`).
 *
 * Time is a structure for football work — not a calendar product, a task
 * manager, or an inbox. Used on Today and Event detail. A `TimelineItem` owns
 * its time position and node state; its content owns everything else (a match
 * item renders `MatchRow` in the content slot).
 *
 * Compact geometry: 48–52px time column, 8px gap, 2px rail, 8–10px node, 12px
 * gap to content, 10–12px item padding. Structural — no per-item floating card,
 * no rail-drawing animation, no perpetual node pulse.
 */

export type TimelineNodeState = "current" | "next" | "later" | "done" | "attention";

const nodeClass: Record<TimelineNodeState, string> = {
  current: "h-2.5 w-2.5 bg-[var(--accent)] ring-4 ring-[var(--accent-subtle)]",
  next: "h-2.5 w-2.5 border-2 border-[var(--accent)] bg-[var(--surface-base)]",
  later: "h-2 w-2 bg-[var(--border-strong)]",
  done: "h-1.5 w-1.5 bg-[var(--border-soft)]",
  attention: "h-2.5 w-2.5 bg-[var(--warning)]",
};

type OperationalTimelineProps = {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
};

export function OperationalTimeline({
  children,
  className,
  "aria-label": ariaLabel = "Operational timeline",
}: OperationalTimelineProps) {
  return (
    <ol aria-label={ariaLabel} className={cn("flex flex-col", className)}>
      {children}
    </ol>
  );
}

type TimelineItemProps = {
  /** "17:30" for a timed item; omit for untimed work (never fake a clock time). */
  timeLabel?: string | null;
  state: TimelineNodeState;
  /** Short uppercase orientation label above the content, e.g. "NOW" / "NEXT". */
  kicker?: string | null;
  /** Last item — the rail stops at the node instead of continuing. */
  isLast?: boolean;
  children: ReactNode;
  className?: string;
};

/** 52px time column + 8px gap → rail sits at left: 60px. */
const RAIL_LEFT = "left-[3.75rem]";

export function TimelineItem({
  timeLabel,
  state,
  kicker,
  isLast = false,
  children,
  className,
}: TimelineItemProps) {
  const muted = state === "done";
  return (
    <li className={cn("relative flex gap-3 py-2.5", className)}>
      {/* rail */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-0 w-0.5 bg-[var(--border-soft)]",
          RAIL_LEFT,
          isLast ? "h-[1.35rem]" : "bottom-0",
        )}
      />
      {/* time column */}
      <span
        className={cn(
          "w-[3.25rem] shrink-0 pt-0.5 text-right text-[13px] tabular-nums",
          muted ? "text-[var(--border-strong)]" : "text-[var(--text-muted)]",
        )}
      >
        {timeLabel ?? ""}
      </span>
      {/* node */}
      <span className="relative z-10 flex w-2.5 shrink-0 justify-center pt-[0.4rem]">
        <span className={cn("mt-px rounded-full", nodeClass[state])} aria-hidden="true" />
      </span>
      {/* content */}
      <div className={cn("min-w-0 flex-1 pl-1", muted && "opacity-70")}>
        {kicker ? (
          <p
            className={cn(
              "app-eyebrow mb-1",
              state === "current" && "text-[var(--accent)]",
              state === "attention" && "text-[var(--warning)]",
            )}
          >
            {kicker}
          </p>
        ) : null}
        {children}
      </div>
    </li>
  );
}
