import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import { buildMatchPreparationDisplayItems, type MatchPreparationInput } from "@/lib/matches/match-detail-view-model";

/**
 * "Match preparation" widget (`03_MATCH_DETAILS_BEFORE_MATCH_SPEC.md` "Match preparation block").
 * Purely presentational over `buildMatchPreparationDisplayItems()` — no selection/warning logic
 * here.
 */
export function MatchPreparationWidget({ input }: { input: MatchPreparationInput }) {
  const items = buildMatchPreparationDisplayItems(input);
  const completeCount = items.filter((i) => i.complete && !i.optional).length;
  const requiredCount = items.filter((i) => !i.optional).length;

  return (
    <TouchlineWidget className="h-full">
      <WidgetHeader eyebrow="Match preparation" title={`${completeCount}/${requiredCount} complete`} />
      <ul className="mt-3 flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-2 text-[13px]">
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.complete ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]"}`}
              />
              <span className={item.complete ? "text-[var(--foreground)]" : "text-[var(--text-muted)]"}>
                {item.label}
                {item.optional ? <span className="ml-1 text-[11px] text-[var(--text-disabled)]">(optional)</span> : null}
              </span>
            </span>
            <span className="text-[12px] text-[var(--text-muted)]">{item.detail}</span>
          </li>
        ))}
      </ul>
    </TouchlineWidget>
  );
}
