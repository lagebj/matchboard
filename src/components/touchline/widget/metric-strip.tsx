import { cn } from "@/lib/cn";

/**
 * MetricStrip (`04_WIDGET_AND_CONTENT_GRAMMAR.md §4`) — several related
 * factual values that make sense together (e.g. Matches / Minutes / Starts /
 * Goals / Assists; Available / Doubtful / Unavailable). Not a set of
 * individual metric cards — one inline row on desktop, a legible 2–3 column
 * grid on compact. Every value is >=12 px.
 */
export type MetricStripItem = {
  id: string;
  label: string;
  value: string;
  /** Optional dot tone, e.g. an availability colour. */
  tone?: "neutral" | "accent" | "attention" | "danger";
};

const toneDot: Record<NonNullable<MetricStripItem["tone"]>, string> = {
  neutral: "bg-[var(--text-muted)]",
  accent: "bg-[var(--accent)]",
  attention: "bg-[var(--warning)]",
  danger: "bg-[var(--danger)]",
};

const toneValue: Record<NonNullable<MetricStripItem["tone"]>, string> = {
  neutral: "text-[var(--foreground)]",
  accent: "text-[var(--accent)]",
  attention: "text-[var(--warning)]",
  danger: "text-[var(--danger)]",
};

type Props = {
  items: MetricStripItem[];
  className?: string;
};

export function MetricStrip({ items, className }: Props) {
  return (
    <dl
      className={cn(
        "grid grid-cols-3 gap-x-4 gap-y-3 medium:flex medium:flex-wrap medium:items-baseline medium:gap-x-6 medium:gap-y-2",
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.id} className="min-w-0">
          <dd className={cn("tl-sport text-[22px] font-[650] leading-none", toneValue[item.tone ?? "neutral"])}>
            {item.tone ? (
              <span
                aria-hidden="true"
                className={cn("mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle", toneDot[item.tone])}
              />
            ) : null}
            {item.value}
          </dd>
          <dt className="mt-1 truncate text-[12px] text-[var(--text-muted)]">{item.label}</dt>
        </div>
      ))}
    </dl>
  );
}
