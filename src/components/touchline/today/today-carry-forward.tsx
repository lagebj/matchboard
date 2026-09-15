import Link from "next/link";
import { TouchlineWidget } from "@/components/touchline/widget/touchline-widget";
import { WidgetHeader } from "@/components/touchline/widget/widget-header";
import type { TodayCarryForwardItem } from "@/lib/touchline/presentation/today-carry-forward";

/**
 * Today "Carry forward" context-rail widget (ADR-0142). Renders the compact adapter's output —
 * never the full-width `WeeklyCoachingContextSection`. Omits itself entirely when there is
 * nothing to carry forward (no invented placeholder row).
 */
export function TodayCarryForwardWidget({ items }: { items: TodayCarryForwardItem[] }) {
  if (items.length === 0) return null;

  return (
    <TouchlineWidget>
      <WidgetHeader title="Carry forward" eyebrow="This week" />
      <ul className="mt-2 flex flex-col divide-y divide-[var(--border-soft)] border-t border-[var(--border-soft)]">
        {items.map((item) => (
          <li key={item.id} className="py-2 text-[13px] text-[var(--text-soft)]">
            <Link href={item.href} className="no-underline hover:underline">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </TouchlineWidget>
  );
}
