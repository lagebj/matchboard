import Link from "next/link";
import { Users } from "lucide-react";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import type { EventsFeaturedEvent } from "@/lib/touchline/presentation/events-overview-view-model";

/**
 * EventsParticipatingSquads (Matchboard Events Operating Surface bundle,
 * `04_DATA_AND_VIEW_MODEL_CONTRACT.md` "Participating squads"). Factual count/status per squad —
 * `Ready` shown only when the canonical EventSquad status is `LOCKED`. Never infers Team kit
 * colour, never infers colour from the squad name, never displays a generated age label.
 */
export function EventsParticipatingSquads({
  orgSlug,
  event,
}: {
  orgSlug: string;
  event: EventsFeaturedEvent;
}) {
  const href = `/o/${orgSlug}/events/${event.eventId}?tab=squads`;

  return (
    <Surface padding="md" className="flex flex-col gap-3">
      <SectionHeader title="Participating squads" description="Squads attending this event." />
      {event.squads.length === 0 ? (
        <p className="text-[13px] text-[var(--text-soft)]">No squads planned yet.</p>
      ) : (
        <ul className="flex flex-col">
          {event.squads.map((squad) => (
            <li key={squad.squadId} className="border-b border-[var(--border-soft)] py-2.5 last:border-b-0">
              <Link
                href={href}
                className="flex items-center justify-between gap-3 no-underline"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Users className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                  <span className="truncate text-[14px] font-[600] text-[var(--foreground)]">
                    {squad.name}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2.5">
                  {squad.isReady ? (
                    <span className="rounded-full bg-[var(--accent-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]">
                      Ready
                    </span>
                  ) : (
                    <span className="text-[12px] text-[var(--text-muted)]">
                      {squad.playerCount} / {squad.targetSize} selected
                    </span>
                  )}
                  <span className="text-[13px] tabular-nums text-[var(--text-soft)]">
                    {squad.playerCount} / {squad.targetSize}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}
