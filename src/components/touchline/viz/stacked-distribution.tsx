import { cn } from "@/lib/cn";
import { vizColorAt } from "@/components/viz/viz-shared";

/**
 * StackedDistribution (Touchline Design Atlas `04_WIDGET_COMPONENT_CONTRACTS.md §3`).
 *
 * A single horizontal bar split proportionally across named categorical shares (role usage,
 * availability mix). Uses the shared neutral categorical palette (`vizColorAt`) — never a
 * red/green good-bad scale. Renders a legend + a visually-hidden text equivalent.
 */
export type StackedDistributionSegment = {
  label: string;
  value: number;
};

export type StackedDistributionProps = {
  question: string;
  segments: StackedDistributionSegment[];
  className?: string;
};

export function StackedDistribution({ question, segments, className }: StackedDistributionProps) {
  const total = Math.max(
    1,
    segments.reduce((acc, s) => acc + s.value, 0),
  );

  return (
    <figure className={cn("flex flex-col gap-2", className)} aria-label={question}>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-[var(--border-soft)]" aria-hidden="true">
        {segments.map((s, i) => {
          const pct = (s.value / total) * 100;
          if (pct <= 0) return null;
          return (
            <div
              key={`${s.label}-${i}`}
              style={{ width: `${pct}%`, backgroundColor: vizColorAt(i) }}
              title={`${s.label}: ${s.value}`}
            />
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-hidden="true">
        {segments.map((s, i) => (
          <li key={`${s.label}-${i}`} className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: vizColorAt(i) }}
            />
            {s.label} {Math.round((s.value / total) * 100)}%
          </li>
        ))}
      </ul>
      <figcaption className="sr-only">
        {segments.map((s) => `${s.label}: ${s.value} (${Math.round((s.value / total) * 100)}%)`).join(", ")}
      </figcaption>
    </figure>
  );
}
