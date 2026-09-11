import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * WorkbenchSummaryStrip (Touchline Finish & Visual Convergence follow-up,
 * `08_PLAYER_EVENT_INSIGHTS_AND_OVERVIEWS.md §6`) — one compact summary strip
 * of counts/decisions above a workbench (Round Board). Approved addition to
 * workbench grammar; not a licence to turn each team into a dashboard card.
 */
export type WorkbenchSummaryItem = {
  id: string;
  label: string;
  value: string;
  tone?: "neutral" | "attention" | "danger";
};

const toneClass: Record<NonNullable<WorkbenchSummaryItem["tone"]>, string> = {
  neutral: "text-[var(--foreground)]",
  attention: "text-[var(--warning)]",
  danger: "text-[var(--danger)]",
};

type Props = {
  items: WorkbenchSummaryItem[];
  trailing?: ReactNode;
  className?: string;
};

export function WorkbenchSummaryStrip({ items, trailing, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 rounded-[var(--tl-radius-widget)] border border-[var(--tl-widget-border)] bg-[var(--tl-widget)] px-4 py-3",
        className,
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        {items.map((item) => (
          <div key={item.id} className="min-w-0">
            <span className={cn("tl-sport text-[18px] font-[650]", toneClass[item.tone ?? "neutral"])}>
              {item.value}
            </span>
            <span className="ml-1.5 text-[12px] text-[var(--text-muted)]">{item.label}</span>
          </div>
        ))}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}
