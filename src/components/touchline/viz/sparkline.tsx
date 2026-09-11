import { cn } from "@/lib/cn";

/**
 * Sparkline (Touchline Design Atlas, `02_REFERENCE_TO_CODE_METHOD.md §5`,
 * `04_WIDGET_COMPONENT_CONTRACTS.md §3`).
 *
 * A tiny inline ordered-trend line over factual per-period values already produced by canonical
 * data. No y-axis clutter, no colour-only signal, one neutral accent line. Renders a
 * visually-hidden text equivalent. Ordered-trend only — never a ranking.
 */
export type SparklineProps = {
  /** The concrete question this answers (accessible name). */
  question: string;
  /** One value per period, oldest first. */
  values: number[];
  periodLabels?: string[];
  formatValue?: (v: number) => string;
  width?: number;
  height?: number;
  className?: string;
};

export function Sparkline({
  question,
  values,
  periodLabels,
  formatValue = String,
  width = 120,
  height = 32,
  className,
}: SparklineProps) {
  const hasData = values.length >= 2;
  const min = hasData ? Math.min(...values) : 0;
  const max = hasData ? Math.max(...values) : 1;
  const span = max - min || 1;
  const stepX = hasData ? width / (values.length - 1) : 0;

  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / span) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const textEquivalent = hasData
    ? values
        .map((v, i) => `${periodLabels?.[i] ?? `period ${i + 1}`}: ${formatValue(v)}`)
        .join(", ")
    : "not enough data yet";

  return (
    <figure className={cn("inline-block", className)} aria-label={question}>
      <span className="sr-only">{textEquivalent}</span>
      {hasData ? (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-hidden="true"
          className="overflow-visible"
        >
          <polyline
            points={points}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {values.map((v, i) => {
            const x = i * stepX;
            const y = height - ((v - min) / span) * (height - 4) - 2;
            const isLast = i === values.length - 1;
            return isLast ? (
              <circle key={i} cx={x} cy={y} r="2.5" fill="var(--accent)" />
            ) : null;
          })}
        </svg>
      ) : (
        <span aria-hidden="true" className="text-[12px] text-[var(--text-muted)]">
          Not enough data yet
        </span>
      )}
    </figure>
  );
}
