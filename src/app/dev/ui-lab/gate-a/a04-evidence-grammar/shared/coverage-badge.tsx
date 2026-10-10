import { cn } from "@/lib/cn";
import { COVERAGE_LABEL, type CoverageStatus } from "./coverage";

/**
 * Neutral coverage-state badge — every one of the six states gets the same quiet treatment.
 * `UNKNOWN`/`NOT_RECORDED` are not an alert and not a low-skill signal (`03_PRESENTATION_AND_
 * INTERACTION_CONTRACT.md`: "unknown is not low player skill or an alert").
 */
export function CoverageBadge({ status, className }: { status: CoverageStatus; className?: string }) {
  return (
    <span
      data-testid="coverage-badge"
      data-coverage={status}
      className={cn(
        "inline-flex items-center rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)]/40 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-muted)]",
        className,
      )}
    >
      {COVERAGE_LABEL[status]}
    </span>
  );
}
