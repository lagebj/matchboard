import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * `PlayersSummaryStrip` (Players Operating Surface visual-convergence follow-up,
 * `07_UI_LAB_AND_VISUAL_MERGE_GATE.md §6` of the corrective bundle). A Players-route-specific
 * compact summary composition — deliberately not a reuse of the generic `MetricTile` (that
 * component stays as-is for Assistant/Round Board; this route needed a flatter, lower, more
 * horizontally-aligned treatment than its square dashboard-card silhouette).
 *
 * Four equal operational summaries, one coherent visual family. No trend arrows, no progress
 * bars, no percentages — only the real semantic tone (`warning` on the opportunity-gap item when
 * its count is above zero; every other item stays neutral).
 */
export type PlayersSummaryStripItem = {
  key: string;
  icon: ReactNode;
  label: string;
  value: number;
  description?: string | null;
  tone?: "neutral" | "warning";
};

export type PlayersSummaryStripProps = {
  items: PlayersSummaryStripItem[];
  className?: string;
};

export function PlayersSummaryStrip({ items, className }: PlayersSummaryStripProps) {
  return (
    <div className={cn("flex flex-wrap items-stretch gap-2", className)}>
      {items.map((item) => (
        <div
          key={item.key}
          className={cn(
            "flex min-w-[150px] flex-1 items-start gap-2 rounded-md border px-3 py-2",
            item.tone === "warning"
              ? "border-[color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[var(--warning-subtle)]"
              : "border-[var(--border-soft)] bg-[var(--surface-base)]",
          )}
        >
          <span
            className={cn("mt-0.5 shrink-0", item.tone === "warning" ? "text-[var(--warning)]" : "text-[var(--text-muted)]")}
            aria-hidden="true"
          >
            {item.icon}
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase leading-none tracking-wider text-[var(--text-muted)]">
              {item.label}
            </p>
            <p
              className={cn(
                "mt-1 text-[18px] font-[700] leading-none tabular-nums",
                item.tone === "warning" ? "text-[var(--warning)]" : "text-[var(--foreground)]",
              )}
            >
              {item.value}
            </p>
            {item.description ? (
              <p className="mt-1 truncate text-[10px] leading-snug text-[var(--text-muted)]">{item.description}</p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
