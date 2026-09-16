import Link from "next/link";
import { Users, CalendarCheck, HeartHandshake, UserPlus } from "lucide-react";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import type { EventsFeaturedEvent } from "@/lib/touchline/presentation/events-overview-view-model";

/**
 * EventsReadiness (Matchboard Events Operating Surface bundle,
 * `04_DATA_AND_VIEW_MODEL_CONTRACT.md` "Event readiness semantics"). Four factual rows — never a
 * fabricated denominator/percentage. Each row links to the owning Event detail tab
 * (`05_INTERACTION_AND_DEEP_LINK_CONTRACT.md`).
 */
export function EventsReadiness({
  orgSlug,
  event,
}: {
  orgSlug: string;
  event: EventsFeaturedEvent;
}) {
  const baseHref = `/o/${orgSlug}/events/${event.eventId}`;
  const { totalSquads, populatedSquads, configuredMatchCount, helperAssignmentCount, guestPlayerCount } =
    event.readiness;

  const rows: Array<{
    key: string;
    icon: typeof Users;
    label: string;
    value: string;
    href: string;
  }> = [
    {
      key: "squads",
      icon: Users,
      label: "Squads drafted",
      value: totalSquads === 0 ? "0 squads planned" : `${populatedSquads} / ${totalSquads}`,
      href: `${baseHref}?tab=squads`,
    },
    {
      key: "matches",
      icon: CalendarCheck,
      label: "Match setup",
      value: configuredMatchCount === 0 ? "Not configured" : `${configuredMatchCount} configured`,
      href: `${baseHref}?tab=matches`,
    },
    {
      key: "helpers",
      icon: HeartHandshake,
      label: "Helpers assigned",
      value: `${helperAssignmentCount} assigned`,
      // Support assignments are match-owned (05 "Event readiness rows").
      href: `${baseHref}?tab=matches`,
    },
    {
      key: "guests",
      icon: UserPlus,
      label: "Guest players",
      value: `${guestPlayerCount}`,
      href: `${baseHref}?tab=pool`,
    },
  ];

  return (
    <Surface padding="md" className="flex flex-col gap-3">
      <SectionHeader title="Event readiness" description="Key setup areas for a successful event." />
      <ul className="grid grid-cols-2 gap-3 expanded:grid-cols-4">
        {rows.map((row) => (
          <li key={row.key}>
            <Link
              href={row.href}
              className="flex h-full flex-col gap-1.5 rounded-[var(--tl-c-radius-control)] border border-[var(--border-soft)] bg-[var(--tl-c-surface)] px-3 py-2.5 no-underline transition-colors hover:border-[var(--border-strong)]"
            >
              <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
                <row.icon className="h-3.5 w-3.5" aria-hidden="true" />
                {row.label}
              </span>
              <span className="text-[16px] font-[620] text-[var(--foreground)]">{row.value}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Surface>
  );
}
