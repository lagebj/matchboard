import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * EvidenceStory (bundle `08_EVIDENCE_STORY_GRAMMAR.md §2`,
 * `12_COMPONENT_CONTRACTS.md §11`).
 *
 * One coherent authored story that answers ONE question — not a metric card in a
 * dashboard grid. Required elements: factual title, one primary value/comparison
 * (Barlow only when the number is the anchor), one purpose-built visual, a
 * factual sample/context line, a bounded interpretation, and an explicit
 * confidence / insufficient-evidence state. No nested cards inside the story.
 *
 * Interpretation stays correlational ("appeared", "coincided with", "more
 * frequent in this sample") — never causal, never a player ranking, never a
 * good/bad colour scale.
 */
type Props = {
  /** The concrete question this story answers (accessible name). */
  question: string;
  /** Quiet uppercase group label, e.g. "MATCH PHASES". */
  label: string;
  /** Factual headline, e.g. "Opening phases remain vulnerable". */
  title: string;
  /** Primary value — Barlow when it is the story anchor. */
  value?: ReactNode;
  /** Prose that always accompanies the value. */
  valueCaption?: string;
  /** One approved visual primitive. */
  visual?: ReactNode;
  /** Factual sample line, e.g. "14 goals · 8 matches". */
  sample?: string;
  /**
   * Engine confidence label (canonical only — e.g. "Emerging", "Established").
   * `null` renders the insufficient-evidence state; the UI never invents its
   * own thresholds.
   */
  confidence?: string | null;
  /** One short factual, non-causal sentence. */
  interpretation?: string;
  detailHref?: string;
  detailLabel?: string;
  className?: string;
};

export function EvidenceStory({
  question,
  label,
  title,
  value,
  valueCaption,
  visual,
  sample,
  confidence,
  interpretation,
  detailHref,
  detailLabel = "See detail",
  className,
}: Props) {
  return (
    <section
      aria-label={question}
      className={cn(
        "flex flex-col gap-2.5 rounded-[var(--tl-c-radius-feature)] border border-[var(--border-soft)] bg-[var(--tl-c-surface)] p-4",
        className,
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {label}
      </p>
      <h3 className="text-[18px] font-[620] leading-snug text-[var(--foreground)]">{title}</h3>

      {value != null ? (
        <div className="flex items-baseline gap-3">
          <span className="tl-evidence-number text-[var(--foreground)]">{value}</span>
          {valueCaption ? (
            <span className="text-[13px] leading-snug text-[var(--text-soft)]">{valueCaption}</span>
          ) : null}
        </div>
      ) : valueCaption ? (
        <p className="text-[13px] leading-snug text-[var(--text-soft)]">{valueCaption}</p>
      ) : null}

      {visual ? <div className="pt-0.5">{visual}</div> : null}

      {interpretation ? (
        <p className="text-[13px] leading-snug text-[var(--text-soft)]">{interpretation}</p>
      ) : null}

      <p className="text-[12px] text-[var(--text-muted)]">
        {sample ? <span>{sample}</span> : null}
        {sample && confidence !== undefined ? <span aria-hidden="true"> · </span> : null}
        {confidence === undefined ? null : confidence === null ? (
          <span className="text-[var(--text-muted)]">Not enough evidence yet</span>
        ) : (
          <span className="font-medium text-[var(--tl-c-evidence)]">{confidence}</span>
        )}
      </p>

      {detailHref ? (
        <Link
          href={detailHref}
          className="text-[13px] font-medium text-[var(--accent)] no-underline hover:underline"
        >
          {detailLabel} <span aria-hidden="true">→</span>
        </Link>
      ) : null}
    </section>
  );
}
