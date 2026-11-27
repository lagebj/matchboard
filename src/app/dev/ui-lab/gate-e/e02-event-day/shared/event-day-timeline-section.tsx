"use client";

import { ScorebookMatchRow, TouchlineTimeline, TimelineItem } from "@/components/touchline";
import { describeSummary, type E02EventDayProjection } from "./event-day-projection";

/**
 * The Event-day progression for E02 — the real `TouchlineTimeline`/`TimelineItem`/
 * `ScorebookMatchRow` primitives production's `EventDayTimeline` uses, rendering the fixture
 * projection instead of a self-fetched list. Same section title ("Event day") as production.
 *
 * Selection (DIRECTIONAL, UI Lab only): each row's real `ScorebookMatchRow` `href` points at
 * this same page with a `match=<eventMatchId>` query value. Production's timeline passes no
 * `href` at all and no production route or URL parameter selects an individual Event match —
 * see `docs/ui-lab/gate-e-w2-candidates/EVENT_AND_MATCH_IDENTITY_CONTRACT.md`.
 */
export function EventDayTimelineSection({
  projection,
  selectHref,
}: {
  projection: E02EventDayProjection;
  selectHref: (matchId: string) => string;
}) {
  const selectedId = projection.selected?.match.id ?? null;
  const multiDay = projection.days.length > 1;
  const summary = describeSummary(projection.summary);

  return (
    <section aria-labelledby="e02-event-day-heading" className="flex min-w-0 flex-col gap-3">
      <div>
        <h2 id="e02-event-day-heading" className="text-[20px] font-[620] text-[var(--foreground)]">
          Event day
        </h2>
        <p className="text-[13px] text-[var(--text-muted)]" data-testid="e02-day-summary">
          {projection.days.length === 1 ? `${projection.days[0].dayLabel} · ` : ""}
          {projection.summary.total} match{projection.summary.total === 1 ? "" : "es"} in kickoff order
          {summary ? ` · ${summary}` : ""}
        </p>
      </div>
      {projection.items.length === 0 ? (
        <p className="text-[13px] text-[var(--text-muted)]">No matches are recorded for this event.</p>
      ) : (
        projection.days.map((day) => (
          <div key={day.dayKey} className="min-w-0">
            {multiDay ? (
              <h3 className="mb-1 text-[13px] font-semibold text-[var(--text-soft)]">{day.dayLabel}</h3>
            ) : null}
            <TouchlineTimeline aria-label="Event-day match timeline">
              {day.items.map((item, idx) => {
                const isSelected = item.match.id === selectedId;
                return (
                  <TimelineItem
                    key={item.match.id}
                    timeLabel={item.timeLabel}
                    state={item.nodeState}
                    kicker={item.kicker}
                    highlighted={isSelected}
                    isLast={idx === day.items.length - 1}
                  >
                    <div data-e02-match-row={item.match.id} data-e02-squad-id={item.match.eventSquadId}>
                      <ScorebookMatchRow presentation={item.presentation} href={selectHref(item.match.id)} />
                      {item.caption ? (
                        <p className="pl-[calc(2px+0.625rem)] text-[11px] text-[var(--text-muted)]">{item.caption}</p>
                      ) : null}
                      {isSelected ? (
                        <p className="pl-[calc(2px+0.625rem)] text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">
                          Selected
                        </p>
                      ) : null}
                    </div>
                  </TimelineItem>
                );
              })}
            </TouchlineTimeline>
          </div>
        ))
      )}
    </section>
  );
}
