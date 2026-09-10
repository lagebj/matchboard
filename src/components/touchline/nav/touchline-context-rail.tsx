"use client";

import { cn } from "@/lib/cn";

/**
 * TouchlineContextRail (bundle `07_TEMPORAL_AND_EVENT_GRAMMAR.md §2`,
 * `12_COMPONENT_CONTRACTS.md §3`) — horizontal local rail for stable adjacent
 * time/sibling contexts: day/date, event day, squad, selected local match.
 *
 * Selected item: accent text + a short accent indicator bar — never a large
 * pill, not a generic pill tab bar. Scroll-snap on compact, edge padding equal
 * to the page gutter, keyboard-navigable as a tablist. Swipe on the parent
 * content is an accelerator only; this tap/click rail is always the path.
 */
export type ContextRailItem = {
  id: string;
  /** Primary label — a day number, squad name, round marker. */
  label: string;
  /** Optional small label above `label`, e.g. a weekday "THU". */
  sublabel?: string;
};

type Props = {
  items: ContextRailItem[];
  selectedId: string;
  onSelect?: (id: string) => void;
  "aria-label": string;
  className?: string;
};

export function TouchlineContextRail({
  items,
  selectedId,
  onSelect,
  "aria-label": ariaLabel,
  className,
}: Props) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      className={cn(
        "flex snap-x snap-mandatory gap-1 overflow-x-auto scroll-px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {items.map((item) => {
        const selected = item.id === selectedId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect?.(item.id)}
            className={cn(
              "relative flex shrink-0 snap-start flex-col items-center gap-0.5 px-3 py-1.5 transition-colors duration-[var(--tl-c-motion-state)]",
              selected ? "text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text-soft)]",
            )}
          >
            {item.sublabel ? (
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">
                {item.sublabel}
              </span>
            ) : null}
            <span
              className={cn(
                "text-[16px] leading-tight",
                selected ? "font-[650]" : "font-medium",
                item.sublabel && "tl-sport text-[18px]",
              )}
            >
              {item.label}
            </span>
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 h-[3px] w-6 rounded-full transition-colors duration-[var(--tl-c-motion-state)]",
                selected ? "bg-[var(--accent)]" : "bg-transparent",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
