import { cn } from "@/lib/cn";

/**
 * MiniBars (Touchline Design Atlas `04_WIDGET_COMPONENT_CONTRACTS.md §3`).
 *
 * Small categorical or temporal counts as a compact bar row. Neutral bars by default; a single
 * `highlighted` bar may use the accent to mark "this one" (e.g. the current period) — never a
 * good/bad colour scale.
 */
export type MiniBarsSegment = {
  label: string;
  value: number;
  highlighted?: boolean;
};

export type MiniBarsProps = {
  question: string;
  segments: MiniBarsSegment[];
  unitLabel?: string;
  height?: number;
  className?: string;
};

export function MiniBars({ question, segments, unitLabel = "", height = 40, className }: MiniBarsProps) {
  const max = Math.max(1, ...segments.map((s) => s.value));

  return (
    <figure className={cn("flex flex-col gap-1", className)} aria-label={question}>
      <div className="flex items-end gap-1" style={{ height }}>
        {segments.map((s, i) => {
          const h = Math.max(3, Math.round((s.value / max) * height));
          return (
            <div
              key={`${s.label}-${i}`}
              className={cn(
                "flex-1 rounded-t-[2px]",
                s.highlighted ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]",
              )}
              style={{ height: h }}
              title={`${s.label}: ${s.value}${unitLabel ? ` ${unitLabel}` : ""}`}
              aria-hidden="true"
            />
          );
        })}
      </div>
      <figcaption className="sr-only">
        {segments.map((s) => `${s.label}: ${s.value}${unitLabel ? ` ${unitLabel}` : ""}`).join(", ")}
      </figcaption>
    </figure>
  );
}
