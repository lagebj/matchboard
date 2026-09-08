import type { ReactNode } from "react";
import Link from "next/link";

/**
 * MetricStory — the reusable evidence presentation: label + primary value + comparator/context +
 * one small visualization + one short factual interpretation + optional detail link.
 *
 * `interpretation` must be a factual, non-causal sentence about what the data shows — never a
 * verdict on a player and never "X caused Y" from correlation.
 */
export type MetricStoryProps = {
  /** The concrete question this story answers. */
  question: string;
  label: string;
  value: ReactNode;
  unit?: string;
  /** A comparator line — e.g. a <DeltaMetric> or plain text like "vs 2.1 season average". */
  comparator?: ReactNode;
  /** One of the viz primitives (TrendSpark / DistributionBar / PeriodBars / RangeBand). */
  visual?: ReactNode;
  /** One short factual, non-causal sentence. */
  interpretation: string;
  /** Evidence/sample context, e.g. "6 completed matches · confidence: emerging". */
  sampleContext?: string;
  detailHref?: string;
  detailLabel?: string;
  className?: string;
};

export function MetricStory({
  question,
  label,
  value,
  unit,
  comparator,
  visual,
  interpretation,
  sampleContext,
  detailHref,
  detailLabel = "Details",
  className,
}: MetricStoryProps) {
  return (
    <section
      className={[
        "flex flex-col gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] p-3.5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={question}
    >
      <p className="app-eyebrow">{label}</p>
      <p className="app-value tabular-nums">
        {value}
        {unit && <span className="ml-1 text-[13px] font-normal text-[var(--text-muted)]">{unit}</span>}
      </p>
      {comparator && <div className="text-[13px] text-[var(--text-soft)]">{comparator}</div>}
      {visual && <div className="pt-0.5">{visual}</div>}
      <p className="text-[13px] text-[var(--text-soft)]">{interpretation}</p>
      {sampleContext && <p className="text-[11px] text-[var(--text-muted)]">{sampleContext}</p>}
      {detailHref && (
        <Link
          href={detailHref}
          className="text-[13px] font-medium text-[var(--accent-strong)] hover:underline"
        >
          {detailLabel} →
        </Link>
      )}
    </section>
  );
}
