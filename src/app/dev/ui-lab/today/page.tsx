import {
  TouchlinePageHeader,
  TouchlineButton,
  TouchlineContextRail,
  OperationalMatchCard,
  TouchlineTimeline,
  TimelineItem,
} from "@/components/touchline";
import { UiLabShell } from "../ui-lab-shells";
import { todayNextMatch, todayDateRail } from "../fixtures";

/**
 * Golden: today-mobile (390×844).
 * Editorial + temporal — date context, one dominant next action, a chronological
 * now/next/later timeline, then quieter context. No metric dashboard above the
 * operational flow.
 */
export default function UiLabTodayPage() {
  return (
    <UiLabShell activeKey="today" contentWidthClass="max-w-[560px]">
      <TouchlinePageHeader title="Today" context="Thursday · 10 Sep" />

      <div className="mt-4">
        <TouchlineContextRail
          aria-label="Day"
          items={todayDateRail}
          selectedId="thu"
        />
      </div>

      <div className="mt-4">
        <OperationalMatchCard
          presentation={todayNextMatch}
          kicker="NEXT"
          contextLine="Saturday · 13:00 · Slemmestad"
          action={<TouchlineButton variant="primary">Open match</TouchlineButton>}
        />
      </div>

      <div className="mt-5">
        <TouchlineTimeline aria-label="Today timeline">
          <TimelineItem timeLabel="17:30" state="later">
            <p className="text-[15px] font-[600] text-[var(--foreground)]">Training</p>
            <p className="text-[13px] text-[var(--text-muted)]">G2015 · Pitch 2</p>
          </TimelineItem>
          <TimelineItem timeLabel="Sat 13:00" state="current" highlighted>
            <p className="text-[15px] font-[600] text-[var(--foreground)]">Rød match</p>
            <p className="text-[13px] font-medium text-[var(--accent)]">2 planning decisions</p>
          </TimelineItem>
          <TimelineItem timeLabel="Sat 14:20" state="later">
            <p className="text-[15px] font-[600] text-[var(--foreground)]">Hvit match</p>
            <p className="text-[13px] text-[var(--text-muted)]">Ready</p>
          </TimelineItem>
          <TimelineItem timeLabel="Mon" state="later" isLast>
            <p className="text-[15px] font-[600] text-[var(--foreground)]">Post-match</p>
            <p className="text-[13px] text-[var(--text-muted)]">2 reports due</p>
          </TimelineItem>
        </TouchlineTimeline>
      </div>
    </UiLabShell>
  );
}
