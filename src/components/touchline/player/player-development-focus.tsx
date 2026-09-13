import Link from "next/link";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";

/**
 * `PlayerDevelopmentFocus` (Atlas Follow-up, `04_PLAYER_DETAIL_CONTRACT.md §4`). Current
 * development focus — never a numeric ranking, just the focus itself, start, observation count
 * and review state where supported.
 */
export type PlayerDevelopmentFocusProps = {
  focus: { id: string; focus: string; category: string | null; href: string } | null;
  className?: string;
};

export function PlayerDevelopmentFocus({ focus, className }: PlayerDevelopmentFocusProps) {
  return (
    <TouchlineWidget className={className}>
      <WidgetHeader eyebrow="Development focus" title={focus ? focus.focus : "No active focus"} />
      {focus ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          {focus.category ? (
            <span className="text-[11px] uppercase tracking-[0.06em] text-[var(--text-muted)]">{focus.category.replace(/_/g, " ")}</span>
          ) : null}
          <Link href={focus.href} className="text-[12px] font-medium text-[var(--accent)] no-underline hover:underline">
            Open <span aria-hidden="true">→</span>
          </Link>
        </div>
      ) : (
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">No development focus is currently active.</p>
      )}
    </TouchlineWidget>
  );
}
