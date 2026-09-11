import { MatchLiveStrip } from "@/components/ui/match-presentation";
import { TouchlineTimeline, TimelineItem } from "@/components/touchline/timeline/touchline-timeline";
import { atlasNav, liveMatchPresentation, liveEventTimeline } from "../../fixtures";
import { UiLabShell } from "../../../ui-lab-shells";

/**
 * Follow Live — `06_ROUTE_COMPOSITION_EVENTS_MATCHDAY.md §G`. Read-only: score, clock, on-field
 * state, events — never a mutation control. Uses the existing Touchline golden pattern.
 */
export default function AtlasFollowLivePage() {
  return (
    <UiLabShell activeKey="league" contentWidthClass="max-w-[560px]" navBuilder={atlasNav}>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Following live</p>
      <MatchLiveStrip presentation={liveMatchPresentation} />

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
