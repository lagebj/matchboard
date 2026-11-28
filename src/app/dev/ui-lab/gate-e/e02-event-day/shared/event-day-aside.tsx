import { formatGameFormat } from "@/lib/formatters/game-format";
import type { E02Event } from "./event-day-fixture-types";
import {
  EVENT_STATUS_LABELS,
  EVENT_TYPE_LABELS,
  formatOsloLongDate,
  type E02EventDayProjection,
  type E02SquadProgress,
} from "./event-day-projection";

/**
 * Supporting Event-day context, deliberately secondary to the timeline: one read-only line of
 * match progression per participating squad (DIRECTIONAL — production's Overview shows squad
 * readiness/assignment counts instead, which need player data E02 does not model), then the
 * Event's own facts. Event facts and match facts are kept in separate sections so Event status
 * (e.g. Finalised) is never read as a match result. Nothing here is interactive.
 */
function describeSquad(p: E02SquadProgress): string {
  const parts = [`${p.total} match${p.total === 1 ? "" : "es"}`];
  if (p.results) parts.push(`${p.results} result${p.results === 1 ? "" : "s"}`);
  if (p.live) parts.push(`${p.live} live`);
  if (p.reportFollowUp) parts.push(`${p.reportFollowUp} report follow-up`);
  if (p.upcoming) parts.push(`${p.upcoming} to come`);
  if (p.cancelled) parts.push(`${p.cancelled} cancelled`);
  return parts.join(" · ");
}

export function EventDayAside({ event, projection }: { event: E02Event; projection: E02EventDayProjection }) {
  return (
    <>
      <section aria-labelledby="e02-squads-heading">
        <h2 id="e02-squads-heading" className="text-[15px] font-[620] text-[var(--foreground)]">
          Squads
        </h2>
        <ul className="mt-2 divide-y divide-[var(--border-soft)]">
          {projection.squadProgress.map((p) => (
            <li key={p.squad.id} className="py-2" data-e02-squad-progress={p.squad.id}>
              <p className="text-[14px] font-[600] text-[var(--foreground)]">{p.squad.name}</p>
              <p className="text-[12px] text-[var(--text-muted)]">{describeSquad(p)}</p>
              {p.nextKickoffLabel ? (
                <p className="text-[12px] text-[var(--text-soft)]">Next kickoff {p.nextKickoffLabel}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="e02-event-facts-heading">
        <h2 id="e02-event-facts-heading" className="text-[15px] font-[620] text-[var(--foreground)]">
          Event details
        </h2>
        <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13px]">
          <dt className="text-[var(--text-muted)]">Type</dt>
          <dd className="text-[var(--foreground)]">{EVENT_TYPE_LABELS[event.eventType]}</dd>
          <dt className="text-[var(--text-muted)]">Game format</dt>
          <dd className="text-[var(--foreground)]">{formatGameFormat(event.gameFormat)}</dd>
          <dt className="text-[var(--text-muted)]">Date</dt>
          <dd className="text-[var(--foreground)]">{formatOsloLongDate(event.startsAt)}</dd>
          <dt className="text-[var(--text-muted)]">Event status</dt>
          <dd className="text-[var(--foreground)]" data-testid="e02-event-status">
            {EVENT_STATUS_LABELS[event.status]}
          </dd>
        </dl>
      </section>
    </>
  );
}
