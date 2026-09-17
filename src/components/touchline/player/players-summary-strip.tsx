import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * `PlayersSummaryStrip` (Players roster-state-and-mobile-convergence pass §9-10). One grouped
 * operational strip — a single outer border/background with internal hairline separators between
 * cells — never four independent bordered cards ("dashboard tile soup"). Four equal cells at
 * `medium`+, a 2×2 grid below it, so the summary occupies roughly one compact block rather than
 * dominating the first mobile viewport.
 *
 * No trend arrows, no progress bars, no percentages, no shadows — only the real semantic tone
 * (`warning` on the opportunity-gap cell when its count is above zero; every other cell stays
 * neutral), applied to that one cell only.
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
    <div
      className={cn(
        "grid grid-cols-2 divide-x divide-y divide-[var(--border-soft)] overflow-hidden rounded-md border border-[var(--border-soft)] bg-[var(--surface-base)] medium:grid-cols-4 medium:divide-y-0",
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={item.key}
          className={cn(
            "flex items-start gap-2 px-3 py-2",
            item.tone === "warning" && "bg-[var(--warning-subtle)]",
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
              // Hidden at the smallest widths so the mobile 2×2 block stays compact (§10) —
              // the number and label, the load-bearing information, stay visible everywhere.
              <p className="mt-1 hidden truncate text-[10px] leading-snug text-[var(--text-muted)] medium:block">
                {item.description}
              </p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
