import type { ReactNode } from "react";
import { OperationalMatchCard } from "@/components/touchline/match/operational-match-card";
import type { MatchPresentation } from "@/lib/matches/match-presentation";

/**
 * NextMatchHero (Touchline Design Atlas `04_WIDGET_COMPONENT_CONTRACTS.md §2`).
 *
 * The strongest object on Today/Event detail before kickoff. A thin semantic wrapper over the
 * existing `OperationalMatchCard` (`variant="feature"`) — it does not re-derive match truth, only
 * fixes the "this is the hero" visual contract (sport typography time/score, one primary action,
 * optional atmosphere, no invented team logos).
 */
export type NextMatchHeroProps = {
  presentation: MatchPresentation;
  contextLabel?: string; // e.g. "G2015 · League"
  contextLine?: string; // e.g. "Slemmestad · Pitch 1"
  primaryAction: ReactNode;
  className?: string;
};

export function NextMatchHero({ presentation, contextLabel, contextLine, primaryAction, className }: NextMatchHeroProps) {
  return (
    <OperationalMatchCard
      presentation={presentation}
      variant="feature"
      kicker="NEXT MATCH"
      contextLabel={contextLabel}
      contextLine={contextLine}
      action={primaryAction}
      className={className}
    />
  );
}
