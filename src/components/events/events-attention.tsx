"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import {
  EVENTS_ATTENTION_MAX,
  type EventsFeaturedEvent,
} from "@/lib/touchline/presentation/events-overview-view-model";

/**
 * EventsAttention (Matchboard Events Operating Surface bundle,
 * `04_DATA_AND_VIEW_MODEL_CONTRACT.md` "Needs attention"). Renders the conservative, capped
 * (`EVENTS_ATTENTION_MAX`) attention items resolved by `buildEventsOperatingViewModel()` — no
 * domain computation here. A local, non-persisted "Show N more" disclosure is allowed when more
 * items exist beyond the cap (`05_INTERACTION_AND_DEEP_LINK_CONTRACT.md` "No dead controls");
 * there is no separate "checklist" route to navigate to.
 */
export function EventsAttention({
  orgSlug,
  event,
}: {
  orgSlug: string;
  event: EventsFeaturedEvent;
}) {
  const [expanded, setExpanded] = useState(false);
  const baseHref = `/o/${orgSlug}/events/${event.eventId}`;
  const overflowCount = Math.max(0, event.attention.length - EVENTS_ATTENTION_MAX);
  const visibleItems = expanded ? event.attention : event.attention.slice(0, EVENTS_ATTENTION_MAX);

  if (event.attention.length === 0) {
    return (
      <Surface padding="md" className="flex flex-col gap-3">
        <SectionHeader title="Needs attention" description="Items to take care of before the event." />
        <p className="text-[13px] text-[var(--text-soft)]">Nothing needs attention right now.</p>
      </Surface>
    );
  }

  return (
    <Surface padding="md" className="flex flex-col gap-3">
      <SectionHeader title="Needs attention" description="Items to take care of before the event." />
      <ul className="flex flex-col">
        {visibleItems.map((item) => (
          <li key={item.id} className="border-b border-[var(--border-soft)] py-2.5 last:border-b-0">
            <Link
              href={`${baseHref}?tab=${item.target}`}
              className="flex items-start justify-between gap-3 no-underline"
            >
              <span className="flex min-w-0 flex-1 items-start gap-2.5">
                <AlertTriangle
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--tl-c-attention,var(--warning))]"
                  aria-hidden="true"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="text-[14px] font-[600] text-[var(--foreground)]">{item.title}</span>
                  <span className="text-[12px] text-[var(--text-muted)]">{item.description}</span>
                </span>
              </span>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      {overflowCount > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="self-start text-[13px] font-medium text-[var(--accent)] hover:underline"
        >
          {expanded ? "Show less" : `Show ${overflowCount} more`}
        </button>
      ) : null}
    </Surface>
  );
}
