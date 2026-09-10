import { cn } from "@/lib/cn";

/**
 * PhaseDistribution (bundle `08_EVIDENCE_STORY_GRAMMAR.md §6`).
 *
 * Horizontal ordered distribution across phase-sequenced time segments (goals
 * for/against by match phase; occurrence across ordered segments). The
 * interesting phase uses accent / evidence-secondary; the rest use neutral
 * muted values. No red=bad / green=good. Renders a visually-hidden text
 * equivalent and never relies on colour alone (the highlighted bar is also the
 * tallest / first).
 */
export type PhaseSegment = {
  label: string;
  value: number;
  highlighted?: boolean;
};

type Props = {
  question: string;
  segments: PhaseSegment[];
  /** Axis ticks, e.g. [0, 10, 20, 30, 40, 50]. */
  axisTicks?: number[];
  unitLabel?: string;
  className?: string;
};

export function PhaseDistribution({
  question,
  segments,
  axisTicks,
  unitLabel = "",
  className,
}: Props) {
  const max = Math.max(1, ...segments.map((s) => s.value));

  return (
    <figure className={cn("flex flex-col gap-1.5", className)} aria-label={question}>
      <div className="flex items-end gap-1.5" style={{ height: 56 }}>
        {segments.map((s, i) => {
          const h = Math.max(4, Math.round((s.value / max) * 56));
          return (
            <div
              key={`${s.label}-${i}`}
              className={cn(
                "flex-1 rounded-t-[3px]",
                s.highlighted ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]",
              )}
              style={{ height: h }}
              title={`${s.label}: ${s.value}${unitLabel ? ` ${unitLabel}` : ""}`}
            />
          );
        })}
      </div>
      {axisTicks && axisTicks.length > 0 ? (
        <div className="flex justify-between text-[11px] tabular-nums text-[var(--text-muted)]">
          {axisTicks.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      ) : null}
      <figcaption className="sr-only">
        {segments.map((s) => `${s.label}: ${s.value}${unitLabel ? ` ${unitLabel}` : ""}`).join(", ")}
        {". The highlighted segment is "}
        {segments.find((s) => s.highlighted)?.label ?? "none"}.
      </figcaption>
    </figure>
  );
}
