/**
 * Player Detail's Evidence tab (Atlas Follow-up, `04_PLAYER_DETAIL_CONTRACT.md §7`) — "What does
 * Matchboard currently know enough to surface?" Grouped under Opportunity / Position / Match
 * context, each rendered through the existing `EvidenceStory` component
 * (`src/components/touchline/evidence/evidence-story.tsx`) — this view model supplies its data,
 * it does not duplicate that component's `observation → visual → sample → confidence → detail`
 * grammar. No overall player score, no "best player", no negative label (contract's own rule).
 */
export type PlayerEvidenceGroup = "OPPORTUNITY" | "POSITION" | "MATCH_CONTEXT";

export type PlayerEvidenceStoryData = {
  id: string;
  group: PlayerEvidenceGroup;
  question: string;
  title: string;
  value?: string;
  valueCaption?: string;
  sample?: string;
  /** `null` renders the insufficient-evidence state — never a fabricated confidence. */
  confidence: "Emerging" | "Established" | null;
  interpretation?: string;
  /** Optional sparkline series for an Opportunity-group story. */
  sparkline?: number[];
  sparklineLabels?: string[];
  /** Optional position-share series for a Position-group story. */
  positionShares?: { code: string; sharePercent: number }[];
  detailHref?: string;
};

export type PlayerEvidenceViewModelInput = {
  stories: PlayerEvidenceStoryData[];
};

export type PlayerEvidenceViewModel = PlayerEvidenceViewModelInput & {
  storiesByGroup: Record<PlayerEvidenceGroup, PlayerEvidenceStoryData[]>;
};

export function buildPlayerEvidenceViewModel(input: PlayerEvidenceViewModelInput): PlayerEvidenceViewModel {
  // Fixed key order (Opportunity, Position, Match context) regardless of input order —
  // the contract's own grouping order (§7).
  const storiesByGroup: Record<PlayerEvidenceGroup, PlayerEvidenceStoryData[]> = {
    OPPORTUNITY: [],
    POSITION: [],
    MATCH_CONTEXT: [],
  };
  for (const story of input.stories) {
    storiesByGroup[story.group].push(story);
  }
  return { ...input, storiesByGroup };
}
