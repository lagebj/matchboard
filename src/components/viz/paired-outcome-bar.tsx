import { vizColorAt } from "./viz-shared";

/**
 * PairedOutcomeBar — "what two factual outcome measures occurred together?"
 * (ADR-0125, the seventh evidence primitive).
 *
 * Two horizontal rows on the same scale with direct numeric labels — e.g. goals
 * for vs goals against while a combination was on the field. Neutral categorical
 * tokens, never a red/green good-bad treatment, never a ranking against other
 * combinations. Like every viz primitive it takes a required `question`, renders
 * a hidden text equivalent, and never relies on colour alone (the numeric label
 * carries the value).
 */
export type PairedOutcomeRow = {
  label: string;
  value: number;
};

export type PairedOutcomeBarProps = {
  question: string;
  /** Exactly two factual outcome measures on the same scale. */
  rows: [PairedOutcomeRow, PairedOutcomeRow];
  sampleContext?: string;
  formatValue?: (v: number) => string;
  className?: string;
};

export function PairedOutcomeBar({
  question,
  rows,
  sampleContext,
  formatValue = String,
  className,
}: PairedOutcomeBarProps) {
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0);
  const hasData = max > 0 || rows.some((r) => r.value > 0);

  const textEquivalent = hasData
    ? `${question} ${rows.map((r) => `${r.label}: ${formatValue(r.value)}`).join("; ")}.${
        sampleContext ? ` ${sampleContext}.` : ""
      }`
    : `${question} Not enough evidence yet.`;

  return (
    <figure className={className} role="group" aria-label={question}>
      <span className="sr-only">{textEquivalent}</span>
      {hasData ? (
        <div aria-hidden="true" className="flex flex-col gap-1.5">
          {rows.map((r, i) => (
            <div key={r.label} className="grid grid-cols-[7.5rem_1fr_2rem] items-center gap-2">
              <span className="truncate text-[12px] text-[var(--text-muted)]">{r.label}</span>
              <span className="h-2.5 rounded-sm bg-[var(--surface-muted)]">
                <span
                  className="block h-2.5 rounded-sm"
                  style={{
                    width: `${max > 0 ? Math.max(2, (r.value / max) * 100) : 0}%`,
                    background: vizColorAt(i),
                  }}
                />
              </span>
              <span className="text-right text-[12px] tabular-nums text-[var(--text-soft)]">
                {formatValue(r.value)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-[var(--text-muted)]" aria-hidden="true">
          Not enough evidence yet
        </p>
      )}
      {sampleContext && hasData ? (
        <figcaption className="mt-1 text-[11px] text-[var(--text-muted)]">{sampleContext}</figcaption>
      ) : null}
    </figure>
  );
}
