/**
 * Today quiet-day composition (ADR-0157 §6, `04_TODAY_SURFACE.md` composition state A). Renders
 * only when `selectTodayComposition()` resolves `"QUIET"` — the calm hero, compact readiness
 * facts (only when no same-day Matchday object already shows its own), the bounded "This week"
 * chronology, and at most one carry-forward item. No empty Next Action / Selection decisions /
 * Planning attention / Other attention / review sections — those stay out of this composition
 * entirely rather than rendering and then happening to be empty.
 */

import Link from "next/link";
import { SquadReadinessWidget } from "@/components/touchline/widgets";
import { TodayCarryForwardWidget } from "@/components/touchline/today/today-carry-forward";
import type { TodaySquadStatus } from "@/lib/touchline/presentation/today-view-model";
import type { TodayCarryForwardItem } from "@/lib/touchline/presentation/today-carry-forward";
import type { TodayWeekChronologyItem } from "@/lib/touchline/presentation/today-composition";

function TodayWeekChronology({ items }: { items: TodayWeekChronologyItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">This week</p>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-3 text-sm">
            <Link href={item.href} className="min-w-0 truncate text-[var(--foreground)] hover:underline">
              {item.label}
            </Link>
            <span className="shrink-0 text-xs text-[var(--text-muted)]">{item.meta}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TodayQuietState({
  heroTitle,
  heroDescription,
  showSquadReadiness,
  squadStatus,
  weekChronologyItems,
  carryForwardItems,
}: {
  heroTitle: string;
  heroDescription: string;
  /** False when a same-day Matchday object already renders its own readiness above this
   * composition — avoids a duplicate readiness block for the same match. */
  showSquadReadiness: boolean;
  squadStatus?: TodaySquadStatus | null;
  weekChronologyItems: TodayWeekChronologyItem[];
  carryForwardItems: TodayCarryForwardItem[];
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 rounded-[var(--tl-c-radius-feature)] border border-[var(--border-soft)] bg-[var(--tl-c-surface-strong)] p-4">
        <h2 className="text-[20px] font-[620] leading-snug text-[var(--foreground)]">{heroTitle}</h2>
        <p className="text-[13px] leading-snug text-[var(--text-soft)]">{heroDescription}</p>
      </div>

      {showSquadReadiness && squadStatus && (
        <SquadReadinessWidget available={squadStatus.available} doubtful={squadStatus.doubtful} unavailable={squadStatus.unavailable} exceptions={[]} />
      )}

      <TodayWeekChronology items={weekChronologyItems} />

      <TodayCarryForwardWidget items={carryForwardItems.slice(0, 1)} />
    </div>
  );
}
