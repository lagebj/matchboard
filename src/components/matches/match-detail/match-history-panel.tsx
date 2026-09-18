import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PreviousEncountersDisplay } from "@/components/opponents/previous-encounters-display";
import type { OpponentHistoryData } from "@/lib/audit/opponent-history";

/** "History" tab (AFTER-match only) — existing opponent-history data, no fabricated head-to-head
 * record (`04_MATCH_DETAILS_AFTER_MATCH_SPEC.md`). */
export function MatchHistoryPanel({
  opponentTeamId,
  opponentHistory,
  opponentConcernCount,
  opponentLatestConcernDate,
}: {
  opponentTeamId: string | null;
  opponentHistory: OpponentHistoryData | null;
  opponentConcernCount: number;
  opponentLatestConcernDate: string | null;
}) {
  if (!opponentTeamId || !opponentHistory) {
    return <EmptyState title="No opponent history available." description="History appears once this opponent is linked to a canonical profile." />;
  }

  return (
    <Surface padding="md">
      <SectionHeader
        title="Head-to-head record"
        description={`${opponentHistory.totalPlayed} played · ${opponentHistory.totalWon}W ${opponentHistory.totalDrawn}D ${opponentHistory.totalLost}L`}
      />
      <div className="mt-3">
        <PreviousEncountersDisplay
          history={opponentHistory}
          concernCount={opponentConcernCount}
          latestConcernDate={opponentLatestConcernDate}
          opponentTeamId={opponentTeamId}
        />
      </div>
    </Surface>
  );
}
