import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { MatchTimelineList } from "@/components/matches/match-detail/match-timeline-list";
import type { MatchTimelineItem } from "@/lib/matches/match-detail-view-model";

/** "Events" tab — the full chronological event list (`04_MATCH_DETAILS_AFTER_MATCH_SPEC.md`). */
export function MatchEventsPanel({
  timeline,
  ownTeamName,
  opponentName,
}: {
  timeline: MatchTimelineItem[];
  ownTeamName: string;
  opponentName: string;
}) {
  return (
    <Surface padding="md">
      <SectionHeader title="Match events" description="Canonical events first; stored goal minute is fallback. No inferred assist pairing." />
      <div className="mt-3">
        <MatchTimelineList items={timeline} ownTeamName={ownTeamName} opponentName={opponentName} />
      </div>
    </Surface>
  );
}
