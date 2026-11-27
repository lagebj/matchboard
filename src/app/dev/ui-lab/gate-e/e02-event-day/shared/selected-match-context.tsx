"use client";

import { forwardRef } from "react";
import { ScorebookMatchRow, TouchlineButton } from "@/components/touchline";
import { describeLiveReportingEntryPointLabel } from "@/lib/live-match/live-reporting-primary-action";
import type { E02Event } from "./event-day-fixture-types";
import { REPORT_STATE_LABELS, type E02DayItem } from "./event-day-projection";

/**
 * Selected-match context for E02 (DIRECTIONAL, `CONTEXT_INSPECTOR` per
 * `17_CONTEXT_LOCAL_INTERACTION_CONTRACT.md`): the coach stays on Event day, the parent Event
 * heading never changes, and the match keeps the exact same `ScorebookMatchRow` identity it has
 * in the timeline (XR-S01).
 *
 * The three outbound links are the REAL production destinations `EventMatchesTab` already
 * offers for an Event match, with the same visibility rules
 * (`src/app/(app)/events/[eventId]/event-matches-tab.tsx`): Live Reporting
 * (`/o/{org}/events/{eventId}/matches/{eventMatchId}/live`, labelled by the canonical
 * `describeLiveReportingEntryPointLabel()`), Follow Live (`.../live/follow`), and the Event's
 * Matches tab (`?tab=matches`), which is where production keeps an Event match's report, lineup
 * and helpers. No Event Match Detail page exists in production, so none is linked.
 */
type Props = {
  event: E02Event;
  item: E02DayItem;
  orgSlug: string;
  onClose: () => void;
};

export const SelectedMatchContext = forwardRef<HTMLHeadingElement, Props>(function SelectedMatchContext(
  { event, item, orgSlug, onClose },
  headingRef,
) {
  const m = item.match;
  const cancelled = m.status === "CANCELLED";
  const liveHref = `/o/${orgSlug}/events/${event.id}/matches/${m.id}/live`;
  const showLiveEntry = !cancelled && m.report?.status !== "LOCKED";
  const liveLabel = m.livePrimaryAction ? describeLiveReportingEntryPointLabel(m.livePrimaryAction) : "Start live reporting";

  // A DRAFT report's score is never displayed anywhere in this candidate (ADR-0001: "DRAFT
  // reports show nothing"). Production's `EventMatchesTab` does show it next to a "Draft" pill;
  // this candidate deliberately does not.
  let reportText = REPORT_STATE_LABELS[item.reportState];
  if (item.reportState === "DRAFT") {
    reportText = "Draft — not final, no result shown";
  } else if (item.reportState === "REPORTED") {
    reportText = "Reported — result recorded, report not locked";
  } else if (item.reportState === "LOCKED") {
    reportText = "Completed — report locked";
  } else if (item.lifecycle === "played") {
    reportText = "No report recorded";
  }

  return (
    <section
      id="e02-selected-match"
      aria-labelledby="e02-selected-heading"
      data-e02-selected-match={m.id}
      className="rounded-[var(--tl-c-radius-object)] border border-[var(--border-soft)] bg-[var(--tl-c-surface)] px-4 py-3"
    >
      <h2
        id="e02-selected-heading"
        ref={headingRef}
        tabIndex={-1}
        className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        Selected match
      </h2>
      <ScorebookMatchRow presentation={item.presentation} />
      <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13px]">
        <dt className="text-[var(--text-muted)]">Event</dt>
        <dd className="text-[var(--foreground)]">{event.name}</dd>
        <dt className="text-[var(--text-muted)]">Squad</dt>
        <dd className="text-[var(--foreground)]" data-testid="e02-selected-squad">
          {item.squad?.name ?? "Unknown squad"}
        </dd>
        <dt className="text-[var(--text-muted)]">Opponent</dt>
        <dd className="text-[var(--foreground)]">{m.opponentName}</dd>
        <dt className="text-[var(--text-muted)]">Kickoff</dt>
        <dd className="text-[var(--foreground)]" data-testid="e02-selected-kickoff">
          {item.presentation.kickoffDate} · {item.timeLabel}
        </dd>
        <dt className="text-[var(--text-muted)]">State</dt>
        <dd className="text-[var(--foreground)]" data-testid="e02-selected-state">
          {item.stateLabel}
        </dd>
        {cancelled ? (
          <>
            <dt className="text-[var(--text-muted)]">Reason</dt>
            <dd className="text-[var(--foreground)]">{m.cancelledReason ?? "No reason recorded"}</dd>
          </>
        ) : (
          <>
            <dt className="text-[var(--text-muted)]">Report</dt>
            <dd className="text-[var(--foreground)]" data-testid="e02-selected-report">
              {reportText}
            </dd>
          </>
        )}
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {showLiveEntry ? (
          <TouchlineButton as="a" href={liveHref} variant={item.lifecycle === "live" ? "primary" : "secondary"} size="sm">
            {liveLabel}
          </TouchlineButton>
        ) : null}
        {!cancelled ? (
          <TouchlineButton as="a" href={`${liveHref}/follow`} variant="ghost" size="sm">
            Follow live
          </TouchlineButton>
        ) : null}
        <TouchlineButton as="a" href={`/o/${orgSlug}/events/${event.id}?tab=matches`} variant="ghost" size="sm">
          Report and lineup in Matches tab
        </TouchlineButton>
      </div>
      <div className="mt-3 border-t border-[var(--border-soft)] pt-3">
        <TouchlineButton type="button" variant="secondary" size="sm" onClick={onClose}>
          Back to event day
        </TouchlineButton>
      </div>
    </section>
  );
});
