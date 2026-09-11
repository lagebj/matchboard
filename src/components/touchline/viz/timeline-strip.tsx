import { cn } from "@/lib/cn";

/**
 * TimelineStrip (Touchline Design Atlas `04_WIDGET_COMPONENT_CONTRACTS.md §3`).
 *
 * A compact horizontal sequence of dated/labelled markers — movement history, rotation
 * out/in pairs. Distinct from `TouchlineTimeline` (a vertical now/next/later schedule): this is a
 * dense horizontal scan strip for "what happened, in order," not "what's coming up."
 */
export type TimelineStripEntry = {
  id: string;
  label: string;
  sublabel?: string;
  tone?: "neutral" | "accent" | "attention";
};

export type TimelineStripProps = {
  question: string;
  entries: TimelineStripEntry[];
  className?: string;
};

const dotClass: Record<NonNullable<TimelineStripEntry["tone"]>, string> = {
  neutral: "bg-[var(--text-muted)]",
  accent: "bg-[var(--accent)]",
  attention: "bg-[var(--warning)]",
};

export function TimelineStrip({ question, entries, className }: TimelineStripProps) {
  if (entries.length === 0) {
    return (
      <p className={cn("text-[13px] text-[var(--text-muted)]", className)} aria-label={question}>
        No recorded movement yet.
      </p>
    );
  }

  return (
    <ol
      className={cn(
        "flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      aria-label={question}
    >
      {entries.map((e, i) => (
        <li key={e.id} className="flex shrink-0 items-start gap-2">
          <span
            aria-hidden="true"
            className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", dotClass[e.tone ?? "neutral"])}
          />
          <span className="max-w-[140px]">
            <span className="block text-[13px] font-[600] text-[var(--foreground)]">{e.label}</span>
            {e.sublabel ? (
              <span className="block text-[11px] text-[var(--text-muted)]">{e.sublabel}</span>
            ) : null}
          </span>
          {i < entries.length - 1 ? (
            <span aria-hidden="true" className="mt-1.5 h-px w-6 shrink-0 bg-[var(--border-soft)]" />
          ) : null}
        </li>
      ))}
    </ol>
  );
}
