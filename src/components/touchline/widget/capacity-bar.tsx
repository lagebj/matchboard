import { cn } from "@/lib/cn";

/**
 * CapacityBar (`04_WIDGET_AND_CONTENT_GRAMMAR.md §5`) — squad count vs target,
 * or another already-existing bounded capacity concept. Not for unbounded
 * performance/evidence values.
 */
type Props = {
  value: number;
  max: number;
  label?: string;
  className?: string;
};

export function CapacityBar({ value, max, label, className }: Props) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={cn("w-full", className)}>
      {label ? <p className="mb-1.5 text-[12px] text-[var(--text-muted)]">{label}</p> : null}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label ?? "Capacity"}
        className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--tl-c-surface-strong)]"
      >
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-[var(--tl-c-motion-content)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
