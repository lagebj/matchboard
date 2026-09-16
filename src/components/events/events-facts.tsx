import { Trophy, CalendarDays, Users, ListChecks } from "lucide-react";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import type { EventsFeaturedEvent } from "@/lib/touchline/presentation/events-overview-view-model";

/**
 * EventsFacts (Matchboard Events Operating Surface bundle,
 * `04_DATA_AND_VIEW_MODEL_CONTRACT.md` "Event facts"). Exactly the four currently-backed rows —
 * Type/Date/Participating squads/Configured matches. Deliberately never shows Location: current
 * Matchboard has no canonical Event-level venue/location field (01 "What the golden does not
 * own").
 */
export function EventsFacts({ event }: { event: EventsFeaturedEvent }) {
  const rows = [
    { key: "type", icon: Trophy, label: "Type", value: event.facts.typeLabel },
    { key: "date", icon: CalendarDays, label: "Date", value: event.facts.dateLabel },
    {
      key: "squads",
      icon: Users,
      label: "Participating squads",
      value: `${event.facts.participatingSquadsCount}`,
    },
    {
      key: "matches",
      icon: ListChecks,
      label: "Configured matches",
      value: `${event.facts.configuredMatchCount}`,
    },
  ];

  return (
    <Surface padding="md" className="flex flex-col gap-3">
      <SectionHeader title="Event facts" />
      <dl className="flex flex-col">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex items-center justify-between gap-3 border-b border-[var(--border-soft)] py-2.5 last:border-b-0"
          >
            <dt className="flex items-center gap-2 text-[13px] text-[var(--text-muted)]">
              <row.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {row.label}
            </dt>
            <dd className="text-[13px] font-[600] text-[var(--foreground)]">{row.value}</dd>
          </div>
        ))}
      </dl>
    </Surface>
  );
}
