import { cn } from "@/lib/cn";

/**
 * DotComparison (Touchline Design Atlas `04_WIDGET_COMPONENT_CONTRACTS.md §3`; the spec-approved
 * ninth-family primitive named but not previously built — see ADR-0125/AGENTS.md's "may be added
 * when first needed without a further ADR").
 *
 * Two small factual counts shown as dot grids on one shared scale — e.g. planned vs realised
 * opportunities. Neutral tone only; no colour-coded good/bad.
 */
export type DotComparisonProps = {
  question: string;
  leftLabel: string;
  leftValue: number;
  rightLabel: string;
  rightValue: number;
  maxDots?: number;
  className?: string;
};

function DotRow({ filled, total }: { filled: number; total: number }) {
  return (
    <div className="flex flex-wrap gap-1" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-2.5 w-2.5 rounded-full",
            i < filled ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]",
          )}
        />
      ))}
    </div>
  );
}

export function DotComparison({
  question,
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  maxDots = 10,
  className,
}: DotComparisonProps) {
  const total = Math.max(leftValue, rightValue, 1, Math.min(maxDots, Math.max(leftValue, rightValue)));
  const dotsTotal = Math.min(maxDots, total);

  return (
    <div className={cn("flex flex-col gap-2", className)} role="group" aria-label={question}>
      <span className="sr-only">
        {leftLabel}: {leftValue}. {rightLabel}: {rightValue}.
      </span>
      <div aria-hidden="true" className="flex items-center justify-between gap-3 text-[12px] text-[var(--text-muted)]">
        <span>{leftLabel}</span>
        <span className="tabular-nums font-[600] text-[var(--foreground)]">{leftValue}</span>
      </div>
      <DotRow filled={Math.min(leftValue, dotsTotal)} total={dotsTotal} />
      <div aria-hidden="true" className="mt-1 flex items-center justify-between gap-3 text-[12px] text-[var(--text-muted)]">
        <span>{rightLabel}</span>
        <span className="tabular-nums font-[600] text-[var(--foreground)]">{rightValue}</span>
      </div>
      <DotRow filled={Math.min(rightValue, dotsTotal)} total={dotsTotal} />
    </div>
  );
}
