/**
 * PeriodBars — "when in the match/sequence does a pattern occur?"
 *
 * A small vertical bar chart over named match phases / sequence positions. Bars are a single
 * neutral fill; height encodes the value, and each bar is labelled below. No good/bad colour.
 */
export type PeriodBar = {
  label: string;
  value: number;
};

export type PeriodBarsProps = {
  question: string;
  bars: PeriodBar[];
  sampleContext?: string;
  formatValue?: (v: number) => string;
  /** Bar area height in px. */
  height?: number;
  className?: string;
};

export function PeriodBars({
  question,
  bars,
  sampleContext,
  formatValue = String,
  height = 64,
  className,
}: PeriodBarsProps) {
  const max = bars.reduce((m, b) => Math.max(m, b.value), 0);
  const hasData = bars.length > 0 && max > 0;

  const textEquivalent = hasData
    ? `${question} ${bars.map((b) => `${b.label}: ${formatValue(b.value)}`).join("; ")}.${
        sampleContext ? ` ${sampleContext}.` : ""
      }`
    : `${question} No pattern recorded yet.`;

  return (
    <figure className={className} role="group" aria-label={question}>
      <span className="sr-only">{textEquivalent}</span>
      {hasData ? (
        <div aria-hidden="true">
          <div className="flex items-end gap-1.5" style={{ height }}>
            {bars.map((b) => (
              <div key={b.label} className="flex flex-1 flex-col items-center justify-end">
                <span className="mb-0.5 text-[11px] tabular-nums text-[var(--text-muted)]">
                  {formatValue(b.value)}
                </span>
                <div
                  className="w-full rounded-t-sm bg-[var(--accent)]"
                  style={{ height: `${max > 0 ? Math.max(2, (b.value / max) * (height - 16)) : 2}px` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-1.5">
            {bars.map((b) => (
              <span
                key={b.label}
                className="flex-1 text-center text-[11px] leading-tight text-[var(--text-muted)]"
              >
                {b.label}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-[var(--text-muted)]" aria-hidden="true">
          No pattern recorded yet
        </p>
      )}
      {sampleContext && hasData && (
        <figcaption className="mt-1 text-[11px] text-[var(--text-muted)]">{sampleContext}</figcaption>
      )}
    </figure>
  );
}
