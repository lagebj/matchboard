import { directionWord } from "./viz-shared";

/**
 * TrendSpark — "is this changing over recent periods?"
 *
 * A tiny inline sparkline over factual per-period values already produced by canonical data.
 * Direction is described in words; colour is a single neutral accent (no good/bad).
 */
export type TrendSparkProps = {
  /** The concrete question this answers, shown as the accessible description. */
  question: string;
  /** One value per period, oldest first. */
  values: number[];
  /** Optional period labels, same length/order as `values` (used in the text equivalent). */
  periodLabels?: string[];
  /** Short factual context, e.g. "Last 6 completed rounds". */
  sampleContext?: string;
  /** Formats a value for the text equivalent (default: String). */
  formatValue?: (v: number) => string;
  width?: number;
  height?: number;
  className?: string;
};

export function TrendSpark({
  question,
  values,
  periodLabels,
  sampleContext,
  formatValue = String,
  width = 120,
  height = 32,
  className,
}: TrendSparkProps) {
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

  const first = values[0];
  const last = values[values.length - 1];
  const dir = hasData ? directionWord(last - first) : "unchanged";

  const textEquivalent = hasData
    ? `${question} Values${sampleContext ? ` (${sampleContext})` : ""}: ${values
        .map((v, i) => `${periodLabels?.[i] ? `${periodLabels[i]}: ` : ""}${formatValue(v)}`)
        .join(", ")}. Latest ${formatValue(last)}, ${dir} from ${formatValue(first)} at the start.`
    : `${question} Not enough data to show a trend yet.`;

  return (
    <figure className={className} role="group" aria-label={question}>
      <span className="sr-only">{textEquivalent}</span>
      {hasData ? (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          aria-hidden="true"
          className="overflow-visible"
        >
          <polyline
            points={points}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx={((values.length - 1) * stepX).toFixed(1)}
            cy={(height - ((last - min) / span) * (height - 4) - 2).toFixed(1)}
            r={2.5}
            fill="var(--accent-strong)"
          />
        </svg>
      ) : (
        <span aria-hidden="true" className="text-[13px] text-[var(--text-muted)]">
          Not enough data yet
        </span>
      )}
      {sampleContext && (
        <figcaption className="mt-1 text-[11px] text-[var(--text-muted)]">{sampleContext}</figcaption>
      )}
    </figure>
  );
}
