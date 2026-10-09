import { cn } from "@/lib/cn";
import type { ProfileEvidenceAggregate } from "../shared/profile-position-model";

/**
 * `LegacyEvidenceDrilldown` — A12 UI Lab candidate only. Shows a profile label's aggregated
 * exact-match evidence without ever hiding or rewriting the original 24-code sided intervals
 * (`20_UI_LAB_CANDIDATE_WAVES.md` A12). Purely presentational — the aggregation itself happens in
 * `aggregateExactAppearancesByProfile` (shared, unit-tested).
 */
type Props = {
  aggregate: ProfileEvidenceAggregate;
  className?: string;
};

export function LegacyEvidenceDrilldown({ aggregate, className }: Props) {
  return (
    <div className={cn("rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)]/30 p-3", className)}>
      <p className="text-[13px] font-medium text-[var(--foreground)]">
        {aggregate.profile}: {aggregate.totalMinutes} min across {aggregate.appearanceCount} appearance
        {aggregate.appearanceCount === 1 ? "" : "s"}
      </p>
      <ul className="mt-1.5 flex flex-col gap-0.5">
        {aggregate.breakdown.map((row, i) => (
          <li key={i} className="text-[11px] text-[var(--text-muted)]">
            {row.tacticalPosition} — {row.minutes} min
          </li>
        ))}
      </ul>
    </div>
  );
}
