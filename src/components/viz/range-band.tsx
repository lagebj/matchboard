import { rangePosition } from "./viz-shared";

/**
 * RangeBand — "is a value inside or outside a meaningful historical range?"
 *
 * IMPORTANT: only use this when a real canonical baseline range exists. The caller MUST supply
 * `rangeLow`/`rangeHigh` from actual historical data and a `sampleContext` naming where the
 * range comes from. This primitive never invents an "ideal" range, and "within / above / below
 * range" is descriptive, not a verdict.
 */
export type RangeBandProps = {
  question: string;
  value: number;
  /** Track bounds. */
  min: number;
  max: number;
  /** The historical range, from canonical data. */
  rangeLow: number;
  rangeHigh: number;
  /** Required: names the source of the range, e.g. "Team's own 2–3 goals/match this season". */
  sampleContext: string;
  formatValue?: (v: number) => string;
  className?: string;
};

function clampPct(v: number, min: number, max: number): number {
  const span = max - min || 1;
  return Math.min(100, Math.max(0, ((v - min) / span) * 100));
}

export function RangeBand({
  question,
  value,
  min,
  max,
  rangeLow,
  rangeHigh,
  sampleContext,
  formatValue = String,
  className,
}: RangeBandProps) {
  const position = rangePosition(value, rangeLow, rangeHigh);
  const bandLeft = clampPct(rangeLow, min, max);
  const bandRight = clampPct(rangeHigh, min, max);
  const markerLeft = clampPct(value, min, max);

  const textEquivalent = `${question} Current value ${formatValue(value)} is ${position} (${formatValue(
    rangeLow,
  )} to ${formatValue(rangeHigh)}). ${sampleContext}.`;

  return (
    <figure className={className} role="group" aria-label={question}>
      <span className="sr-only">{textEquivalent}</span>
      <div className="relative h-6" aria-hidden="true">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--surface-muted)]" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--accent-subtle)]"
          style={{ left: `${bandLeft}%`, width: `${Math.max(0, bandRight - bandLeft)}%` }}
        />
        <div
          className="absolute top-1/2 h-3.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded bg-[var(--accent-strong)]"
          style={{ left: `${markerLeft}%` }}
        />
      </div>
      <p className="mt-1 text-[13px] text-[var(--text-soft)]" aria-hidden="true">
        <span className="tabular-nums">{formatValue(value)}</span>
        <span className="text-[var(--text-muted)]"> · {position}</span>
      </p>
      <figcaption className="mt-0.5 text-[11px] text-[var(--text-muted)]">
        Range {formatValue(rangeLow)}–{formatValue(rangeHigh)} · {sampleContext}
      </figcaption>
    </figure>
  );
}
