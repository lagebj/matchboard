import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import type { RoundBoardAttentionItem } from "@/lib/touchline/presentation/round-board-view-model";

/**
 * `RoundAttentionList` (Atlas Follow-up, `02_ROUND_BOARD_CONTRACT.md §6`) — unresolved decisions
 * surfaced before routine allocations. Never styled as a generic error list; Blocked and Decision
 * required are the only two severities (contract's own signal model — no "info"/"warning" here).
 */
export type RoundAttentionListProps = {
  items: RoundBoardAttentionItem[];
  onResolve?: (item: RoundBoardAttentionItem) => void;
  className?: string;
};

export function RoundAttentionList({ items, onResolve, className }: RoundAttentionListProps) {
  if (items.length === 0) return null;

  return (
    <TouchlineWidget className={className}>
      <WidgetHeader eyebrow="Needs attention" title={`${items.length} decision${items.length === 1 ? "" : "s"}`} />
      <ul className="mt-2 flex flex-col divide-y divide-[var(--border-soft)]">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-[600] text-[var(--foreground)]">{item.summary}</p>
              <p className="truncate text-[11px] text-[var(--text-muted)]">{item.detail}</p>
            </div>
            {onResolve ? (
              <button
                type="button"
                onClick={() => onResolve(item)}
                className="shrink-0 rounded-full border border-[var(--border-soft)] px-3 py-1 text-[11px] font-medium text-[var(--text-soft)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                Resolve
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </TouchlineWidget>
  );
}
