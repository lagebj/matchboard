/**
 * Player Detail's Matches tab (Atlas Follow-up, `04_PLAYER_DETAIL_CONTRACT.md §5`) — "What
 * football has this player actually experienced?" Actual minutes/positions only; never inferred
 * from planned lineups when actual data exists (contract's own explicit rule for this tab).
 */
export type PlayerMatchRow = {
  matchId: string;
  source: "LEAGUE" | "EVENT";
  date: string;
  opponentOrEventName: string;
  competitionLabel: string;
  minutes: number | null;
  /** Actual recorded positions this match, in the order played. Empty when no actual data exists yet. */
  actualPositions: string[];
  context: "CORE" | "SUPPORT" | "DEVELOPMENT" | null;
  goals: number;
  assists: number;
  href: string;
};

export type PlayerPositionTimelineEntry = {
  matchLabel: string;
  position: string;
};

export type PlayerMatchesViewModelInput = {
  seasonSummary: { matches: number; minutes: number; starts: number; goals: number; assists: number };
  availableLeagueSeasons: string[];
  availableEvents: string[];
  matches: PlayerMatchRow[];
};

export type PlayerMatchesViewModel = PlayerMatchesViewModelInput & {
  positionTimeline: PlayerPositionTimelineEntry[];
};

/**
 * The compact position timeline (contract §5: "Include a compact position timeline where data is
 * strong enough") is derived directly from the same match rows — one entry per match that has at
 * least one actual position recorded, taking the first (primary) actual position of that match.
 * Never a second, independently-fetched timeline.
 */
export function buildPlayerMatchesViewModel(input: PlayerMatchesViewModelInput): PlayerMatchesViewModel {
  const positionTimeline: PlayerPositionTimelineEntry[] = input.matches
    .filter((m) => m.actualPositions.length > 0)
    .map((m) => ({ matchLabel: m.date, position: m.actualPositions[0] }));

  return { ...input, positionTimeline };
}
