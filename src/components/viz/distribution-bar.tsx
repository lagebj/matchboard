import { vizColorAt, pct, formatPct } from "./viz-shared";

/**
 * DistributionBar — "how is exposure split across categories?"
 *
 * A single horizontal 100%-width bar segmented by category (role, position, phase, …). Colours
 * separate categories; they do not rank them. A legend below carries label + value + share.
 */
export type DistributionSegment = {
  label: string;
  value: number;
};

export type DistributionBarProps = {
  question: string;
  segments: DistributionSegment[];
  /** Short factual context, e.g. "42 realised appearances this season". */
  sampleContext?: string;
  formatValue?: (v: number) => string;
  className?: string;
};

export function DistributionBar({
  question,
  segments,
  sampleContext,
  formatValue = String,
  className,
}: DistributionBarProps) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const visible = segments.filter((s) => s.value > 0);

  const textEquivalent =
    total > 0
      ? `${question} ${visible
          .map((s) => `${s.label}: ${formatValue(s.value)} (${formatPct(s.value, total)})`)
          .join("; ")}.${sampleContext ? ` ${sampleContext}.` : ""}`
      : `${question} No exposure recorded yet.`;

  return (
    <figure className={className} role="group" aria-label={question}>
      <span className="sr-only">{textEquivalent}</span>
      {total > 0 ? (
        <>
          <div
            className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]"
            aria-hidden="true"
          >
            {visible.map((s, i) => (
              <div
                key={s.label}
                style={{ width: `${pct(s.value, total)}%`, background: vizColorAt(i) }}
                className="h-full"
              />
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1" aria-hidden="true">
            {visible.map((s, i) => (
              <li key={s.label} className="flex items-center gap-1.5 text-[13px] text-[var(--text-soft)]">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-[2px]"
                  style={{ background: vizColorAt(i) }}
                />
                <span>{s.label}</span>
                <span className="tabular-nums text-[var(--text-muted)]">
                  {formatValue(s.value)} · {formatPct(s.value, total)}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-[13px] text-[var(--text-muted)]" aria-hidden="true">
          No exposure recorded yet
        </p>
      )}
      {sampleContext && total > 0 && (
        <figcaption className="mt-1 text-[11px] text-[var(--text-muted)]">{sampleContext}</figcaption>
      )}
    </figure>
  );
}
