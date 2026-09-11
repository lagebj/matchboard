import Link from "next/link";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { cn } from "@/lib/cn";

/**
 * AttentionWidget (Touchline Design Atlas `04_WIDGET_COMPONENT_CONTRACTS.md §2`).
 *
 * Shows at most 4 attention items (immediate blocking first, then live-session continuation,
 * matchday decision, due decision review, lower urgency), with a remainder link. Consumes
 * `CoachDecision`-shaped items already ordered/filtered by the situational projection — this
 * widget does not re-rank or re-filter them itself.
 */
export type AttentionItem = {
  id: string;
  title: string;
  summary?: string;
  urgency: "IMMEDIATE" | "SOON" | "NORMAL" | "LOW";
  href?: string;
};

export type AttentionWidgetProps = {
  items: AttentionItem[]; // already ordered by the caller; this widget only slices to 4
  overflowCount?: number;
  overflowHref?: string;
  className?: string;
};

const URGENCY_TONE: Record<AttentionItem["urgency"], string> = {
  IMMEDIATE: "text-[var(--danger)]",
  SOON: "text-[var(--warning)]",
  NORMAL: "text-[var(--text-soft)]",
  LOW: "text-[var(--text-muted)]",
};

export function AttentionWidget({ items, overflowCount = 0, overflowHref, className }: AttentionWidgetProps) {
  const visible = items.slice(0, 4);

  return (
    <TouchlineWidget className={className}>
      <WidgetHeader eyebrow="Needs attention" title={visible.length > 0 ? `${visible.length} item${visible.length === 1 ? "" : "s"}` : "All clear"} />
      {visible.length === 0 ? (
        <p className="mt-3 text-[13px] text-[var(--text-muted)]">Nothing needs a decision right now.</p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-[var(--border-soft)] border-t border-[var(--border-soft)]">
          {visible.map((item) => {
            const body = (
              <div className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[14px] font-[600] text-[var(--foreground)]">{item.title}</p>
                  {item.summary ? (
                    <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{item.summary}</p>
                  ) : null}
                </div>
                <span className={cn("shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em]", URGENCY_TONE[item.urgency])}>
                  {item.urgency === "IMMEDIATE" ? "Now" : item.urgency === "SOON" ? "Soon" : ""}
                </span>
              </div>
            );
            return (
              <li key={item.id}>
                {item.href ? (
                  <Link href={item.href} className="block no-underline hover:bg-[var(--tl-c-surface-hover)]">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}
      {overflowCount > 0 ? (
        overflowHref ? (
          <Link href={overflowHref} className="mt-2 inline-block text-[13px] font-medium text-[var(--accent)] no-underline">
            +{overflowCount} more
          </Link>
        ) : (
          <p className="mt-2 text-[13px] text-[var(--text-muted)]">+{overflowCount} more</p>
        )
      ) : null}
    </TouchlineWidget>
  );
}
