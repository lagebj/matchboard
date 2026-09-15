import { LeagueSeasonRail } from "./league-season-rail";
import { LeagueFocusedRound } from "./league-focused-round";
import { LeagueRecentRounds, LeagueEarlierRounds } from "./league-history-rounds";
import type { LeagueOperatingViewModel } from "@/lib/touchline/presentation/league-view-model";

/**
 * LeagueSurface — the production League composition owner (League Operating Surface bundle,
 * `06_COMPONENT_COMPOSITION_CONTRACT.md`).
 *
 * `FixturesPage` owns data fetching and URL-state orchestration; this component owns layout only:
 * season rail -> focused operational round -> compact recent scorebook history -> earlier-rounds
 * disclosure. No domain computation happens here — everything is pre-resolved by
 * `buildLeagueOperatingViewModel()`.
 */
type Props = {
  viewModel: LeagueOperatingViewModel;
  onSelectRound: (roundId: string) => void;
  earlierExpanded: boolean;
  onToggleEarlier: () => void;
};

export function LeagueSurface({ viewModel, onSelectRound, earlierExpanded, onToggleEarlier }: Props) {
  const { railSlots, focusedRound, recentRounds, earlierRounds } = viewModel;

  return (
    <div className="flex flex-col gap-6">
      {railSlots.length > 0 ? <LeagueSeasonRail slots={railSlots} onSelect={onSelectRound} /> : null}

      {focusedRound ? (
        <LeagueFocusedRound round={focusedRound} />
      ) : (
        <p className="py-6 text-center text-[13px] text-[var(--text-muted)]">
          No rounds to focus on in this league season yet.
        </p>
      )}

      {(recentRounds.length > 0 || earlierRounds.length > 0) && (
        <div className="flex flex-col gap-4 border-t border-[var(--border-soft)] pt-4">
          <LeagueRecentRounds rounds={recentRounds} />
          <LeagueEarlierRounds
            rounds={earlierRounds}
            expanded={earlierExpanded}
            onToggle={onToggleEarlier}
          />
        </div>
      )}
    </div>
  );
}
