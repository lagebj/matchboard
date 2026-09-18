import Link from "next/link";
import { Eye } from "lucide-react";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { EmptyState } from "@/components/ui/empty-state";
import { TouchlineButton } from "@/components/touchline";
import { PreviousEncountersDisplay } from "@/components/opponents/previous-encounters-display";
import { PLAYING_STYLE_TAG_LABELS, type PlayingStyleTag } from "@/lib/opponents/playing-style-tags";
import type { OpponentHistoryData } from "@/lib/audit/opponent-history";

/**
 * "Opponent context" — shared between the BEFORE and AFTER Match Details surfaces (both name it
 * in their tab set; content is the same factual opponent profile/history either side of the
 * match). Ported unchanged from the former `match-detail.tsx` "opponent" tab.
 */
export function MatchOpponentContextPanel({
  opponentTeamId,
  opponentHistory,
  opponentConcernCount,
  opponentLatestConcernDate,
  currentMatchStyleTags,
  opponentDetailHref,
}: {
  opponentTeamId: string | null;
  opponentHistory: OpponentHistoryData | null;
  opponentConcernCount: number;
  opponentLatestConcernDate: string | null;
  currentMatchStyleTags: string[];
  opponentDetailHref: string;
}) {
  if (!opponentTeamId) {
    return (
      <EmptyState
        title="No opponent profile linked yet."
        description="A canonical opponent profile is linked when the post-match report is completed."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {currentMatchStyleTags.length > 0 && (
        <Surface padding="md">
          <SectionHeader
            title="Opponent playing style"
            description="Observed style in this encounter. This describes this match, not a fixed trait."
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {currentMatchStyleTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full border border-[var(--border-soft)] bg-[var(--surface-raised)] px-3 py-1 text-xs font-medium text-[var(--foreground)]"
              >
                {PLAYING_STYLE_TAG_LABELS[tag as PlayingStyleTag] ?? tag}
              </span>
            ))}
          </div>
        </Surface>
      )}
      {opponentHistory && (
        <PreviousEncountersDisplay
          history={opponentHistory}
          concernCount={opponentConcernCount}
          latestConcernDate={opponentLatestConcernDate}
          opponentTeamId={opponentTeamId}
        />
      )}
      <Surface padding="md" className="flex flex-col gap-3">
        <SectionHeader title="Opponent context" description="Sporting fit, post-match observations, and full encounter history." />
        <TouchlineButton
          as={Link}
          href={opponentDetailHref}
          variant="primary"
          size="md"
          leadingIcon={<Eye className="h-4 w-4" aria-hidden="true" />}
          className="self-start"
        >
          View opponent detail
        </TouchlineButton>
      </Surface>
    </div>
  );
}
