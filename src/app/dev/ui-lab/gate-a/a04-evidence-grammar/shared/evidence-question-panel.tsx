import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { CoverageBadge } from "./coverage-badge";
import type { CoverageStatus } from "./coverage";

/**
 * `EvidenceQuestionPanel` — A04's dev-only sibling of the real production `EvidenceStory`
 * (`src/components/touchline/evidence/evidence-story.tsx`). Same editorial grammar and the same
 * visual tokens, but with two deliberate differences the real component cannot make:
 *
 * 1. `onInspect` opens a context-local source inspector in place (`SourceInspector`) instead of
 *    `EvidenceStory`'s `detailHref`, which navigates — A04's drilldown must stay on the page
 *    (`03_PRESENTATION_AND_INTERACTION_CONTRACT.md`).
 * 2. `coverage` is one of the six explicit data-truth states, not `EvidenceStory`'s
 *    confidence/`null` pair — a confidence label and a coverage state are different concepts, and
 *    A04 must never conflate them.
 *
 * Required editorial order (question → fact/insufficient-coverage state → optional compact
 * visual → denominator/source/caveat → inspect) is enforced by this component's own field order,
 * not left to each call site to get right.
 */
type Props = {
  question: string;
  label: string;
  title: string;
  value?: ReactNode;
  valueCaption?: string;
  visual?: ReactNode;
  sample?: string;
  coverage: CoverageStatus;
  onInspect?: () => void;
  inspectLabel?: string;
  className?: string;
};

export function EvidenceQuestionPanel({
  question,
  label,
  title,
  value,
  valueCaption,
  visual,
  sample,
  coverage,
  onInspect,
  inspectLabel = "Inspect sources",
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{label}</p>
      <h3 className="text-[18px] font-[620] leading-snug text-[var(--foreground)]">{title}</h3>

      {value != null ? (
        <div className="flex items-baseline gap-3">
          <span className="tl-evidence-number text-[var(--foreground)]">{value}</span>
          {valueCaption ? <span className="text-[13px] leading-snug text-[var(--text-soft)]">{valueCaption}</span> : null}
        </div>
      ) : valueCaption ? (
        <p className="text-[13px] leading-snug text-[var(--text-soft)]">{valueCaption}</p>
      ) : null}

      {visual ? <div className="pt-0.5">{visual}</div> : null}

      <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--text-muted)]">
        {sample ? <span>{sample}</span> : null}
        <CoverageBadge status={coverage} />
      </div>

      {onInspect ? (
        <button
          type="button"
          onClick={onInspect}
          className="self-start text-[13px] font-medium text-[var(--accent)] hover:underline"
        >
          {inspectLabel} <span aria-hidden="true">→</span>
        </button>
      ) : null}
    </section>
  );
}
