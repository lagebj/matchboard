import { directionGlyph, directionWord } from "./viz-shared";

/**
 * DeltaMetric — "how does the current period compare with a relevant previous/baseline period?"
 *
 * Shows the current value and its change from a baseline. Direction is carried by a glyph and a
 * word ("up"/"down"/"unchanged"), never by colour alone, and the wording stays neutral unless
 * the domain meaning is inherently directional (`directional` prop opts into up/down phrasing
 * — it still never says "better"/"worse").
 */
export type DeltaMetricProps = {
  question?: string;
  label: string;
  current: number;
  baseline: number;
  /** e.g. "vs last round", "vs season average". */
  baselineLabel?: string;
  unit?: string;
  formatValue?: (v: number) => string;
  sampleContext?: string;
  className?: string;
};

export function DeltaMetric({
  question,
  label,
  current,
  baseline,
  baselineLabel = "vs baseline",
  unit,
  formatValue = String,
  sampleContext,
  className,
}: DeltaMetricProps) {
  const delta = current - baseline;
  const glyph = directionGlyph(delta);
  const word = directionWord(delta);
  const unitSuffix = unit ? ` ${unit}` : "";
  const deltaText =
    delta === 0
      ? "no change"
      : `${delta > 0 ? "+" : "−"}${formatValue(Math.abs(delta))}${unitSuffix}`;

  const textEquivalent = `${question ? `${question} ` : ""}${label}: ${formatValue(
    current,
  )}${unitSuffix}, ${word} ${
    delta === 0 ? "" : `by ${formatValue(Math.abs(delta))}${unitSuffix} `
  }${baselineLabel} (${formatValue(baseline)}${unitSuffix}).${sampleContext ? ` ${sampleContext}.` : ""}`;

  return (
    <div className={className} role="group" aria-label={label}>
      <span className="sr-only">{textEquivalent}</span>
      <p className="app-eyebrow" aria-hidden="true">
        {label}
      </p>
      <p className="app-value tabular-nums" aria-hidden="true">
        {formatValue(current)}
        {unit && <span className="ml-1 text-[13px] font-normal text-[var(--text-muted)]">{unit}</span>}
      </p>
      <p className="mt-0.5 text-[13px] text-[var(--text-soft)] tabular-nums" aria-hidden="true">
        <span className="mr-1 text-[var(--text-muted)]">{glyph}</span>
        {deltaText}
        <span className="ml-1 text-[var(--text-muted)]">{baselineLabel}</span>
      </p>
      {sampleContext && (
        <p className="mt-0.5 text-[11px] text-[var(--text-muted)]" aria-hidden="true">
          {sampleContext}
        </p>
      )}
    </div>
  );
}
