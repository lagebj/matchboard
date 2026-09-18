import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { MatchNotesEditor } from "@/components/matches/match-detail/match-notes-editor";

/** Dedicated "Notes" tab (`03_MATCH_DETAILS_BEFORE_MATCH_SPEC.md`) — the same real note as the
 * Overview secondary-row tile, just given its own full-width surface for direct `?tab=notes`
 * navigation. */
export function MatchNotesTab({ matchId, notes }: { matchId: string; notes: string | null }) {
  return (
    <Surface padding="md">
      <SectionHeader title="Team notes" description="Reminders or focus areas for this match." />
      <div className="mt-3">
        <MatchNotesEditor matchId={matchId} notes={notes} />
      </div>
    </Surface>
  );
}
