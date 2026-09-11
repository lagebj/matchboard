import { Goal, ArrowLeftRight, Flag, Clock } from "lucide-react";
import { MatchLiveStrip } from "@/components/ui/match-presentation";
import { LiveActionGrid } from "@/components/touchline/live/live-action-grid";
import { TouchlineTimeline, TimelineItem } from "@/components/touchline/timeline/touchline-timeline";
import { atlasNav, liveMatchPresentation, liveEventTimeline } from "../../fixtures";
import { UiLabShell } from "../../../ui-lab-shells";

/**
 * Live Reporting — `06_ROUTE_COMPOSITION_EVENTS_MATCHDAY.md §F`. Golden: live-reporting-mobile.png,
 * exact order (§F): 1. live match strip, 2. supported actions, 3. event timeline, 4. player
 * selection bottom sheet (omitted here — no action is mid-flow in this static fixture render).
 * Only currently-supported `LiveMatchEventType` action kinds are shown — no invented yellow/red/
 * shot/corner (provenance §0.12).
 */
export default function AtlasLiveReportingPage() {
  return (
    <UiLabShell activeKey="league" contentWidthClass="max-w-[560px]" navBuilder={atlasNav}>
      <MatchLiveStrip presentation={liveMatchPresentation} />

      <div className="mt-5">
        <LiveActionGrid
          actions={[
            { key: "goal", label: "Goal", icon: Goal, tone: "primary" },
            { key: "rotation", label: "Rotation", icon: ArrowLeftRight },
            { key: "fair-play", label: "Fair play", icon: Flag },
            { key: "period", label: "Half time", icon: Clock },
          ]}
        />
      </div>

      <div className="mt-6">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Match events</p>
        <TouchlineTimeline aria-label="Live match events">
          {liveEventTimeline.map((e, i) => (
            <TimelineItem key={e.id} timeLabel={e.minuteLabel} state={i === liveEventTimeline.length - 1 ? "current" : "done"} isLast={i === liveEventTimeline.length - 1}>
              <p className="text-[14px] font-[600] text-[var(--foreground)]">{e.label}</p>
            </TimelineItem>
          ))}
        </TouchlineTimeline>
      </div>
    </UiLabShell>
  );
}
