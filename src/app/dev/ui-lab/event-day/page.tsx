import {
  TouchlineContextRail,
  OperationalMatchCard,
  TouchlineTimeline,
  TimelineItem,
} from "@/components/touchline";
import { UiLabShell } from "../ui-lab-shells";
import { eventNextMatch, eventDayRail, eventSquadRail } from "../fixtures";

/**
 * Golden: event-day-mobile (390×844).
 * Timeline-first temporal flow — event identity, a day rail (multi-day only),
 * the current/next object, the event-day timeline, then local squad context.
 */
export default function UiLabEventDayPage() {
  return (
    <UiLabShell activeKey="events" contentWidthClass="max-w-[560px]">
      <header className="pt-1">
        <h1 className="text-[28px] font-[650] leading-[32px] tracking-[-0.01em] text-[var(--foreground)]">
          Skrim Kiwi Bama Cup
        </h1>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">Saturday · 12 Sep · Skrim</p>
      </header>

      <div className="mt-4">
        <TouchlineContextRail aria-label="Event day" items={eventDayRail} selectedId="sat" />
      </div>

      <div className="mt-4">
        <OperationalMatchCard
          presentation={eventNextMatch}
          kicker="NEXT · 11:10 · Pitch 3"
          teamLayout="stacked"
          heroValue="—"
        />
      </div>

      <div className="mt-5">
        <TouchlineTimeline aria-label="Event-day timeline">
          <TimelineItem timeLabel="09:00" state="done">
            <p className="text-[15px] font-[600] text-[var(--foreground)]">Arrival</p>
            <p className="text-[13px] text-[var(--text-muted)]">Meet at main entrance</p>
          </TimelineItem>
          <TimelineItem timeLabel="09:45" state="done">
            <p className="text-[15px] font-[600] text-[var(--foreground)]">Rød 4 · Åssiden 2</p>
            <p className="text-[13px] text-[var(--text-muted)]">FT</p>
          </TimelineItem>
          <TimelineItem timeLabel="11:10" state="current" kicker="Next">
            <p className="text-[15px] font-[600] text-[var(--foreground)]">Rød · Skrim United</p>
            <p className="text-[13px] font-medium text-[var(--accent)]">Pitch 3</p>
          </TimelineItem>
          <TimelineItem timeLabel="12:25" state="later">
            <p className="text-[15px] font-[600] text-[var(--foreground)]">Rød · Konnerud</p>
            <p className="text-[13px] text-[var(--text-muted)]">Pitch 2</p>
          </TimelineItem>
          <TimelineItem timeLabel="14:10" state="later" isLast>
            <p className="text-[15px] font-[600] text-[var(--foreground)]">Rød · ROS</p>
            <p className="text-[13px] text-[var(--text-muted)]">Pitch 1</p>
          </TimelineItem>
        </TouchlineTimeline>
      </div>

      <div className="mt-6">
        <h2 className="text-[20px] font-[620] text-[var(--foreground)]">Squads</h2>
        <div className="mt-2">
          <TouchlineContextRail aria-label="Squad" items={eventSquadRail} selectedId="rod" />
        </div>
      </div>
    </UiLabShell>
  );
}
