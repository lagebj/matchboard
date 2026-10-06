import type { PlayerTrendStory } from "@/lib/development-context/get-player-trend-stories";
import type { PlayerRecentOpportunityInput } from "./player-detail-view-model";

/**
 * Player Detail Overview's `Current story` selector (ADR-0157 slice C5, source bundle
 * `07_PLAYER_DETAIL.md` "Current story selector"). A pure presentation selector -- it never
 * queries the database and never recomputes a trend, position-evolution decision, or opportunity
 * fact; every input here is already-computed canonical evidence, and this module only picks at
 * most one headline sentence from it, in priority order:
 *
 * 1. a material ADR-0155 trend (persisted `DerivedTrend` direction UP/DOWN, never STABLE);
 * 2. a still-current ADR-0139 automatic position-profile-evolution change (a real
 *    `DecisionRecord` before/after snapshot, never a reconstructed historical profile);
 * 3. an active development focus with a recent supporting coach observation;
 * 4. a current opportunity exception relevant to near-term planning.
 *
 * Returns `null` when nothing qualifies -- the spec's own instruction is to omit the block
 * entirely rather than fill the space with generic praise, and this function is the one place
 * that decision is made.
 */

export type PlayerCurrentStorySource = "TREND" | "POSITION_EVOLUTION" | "DEVELOPMENT_FOCUS" | "OPPORTUNITY";

export type PlayerCurrentStory = {
  text: string;
  source: PlayerCurrentStorySource;
};

export type PlayerPositionEvolutionStorySource = {
  newPrimaryLabel: string;
  previousPrimaryLabel: string | null;
};

export type PlayerDevelopmentFocusStorySource = {
  focus: string;
  hasRecentSupportingObservation: boolean;
};

export type PlayerCurrentStoryInput = {
  /** From `getPlayerTrendStories()` -- only `TREND`-kind entries with a non-STABLE direction
   * ever qualify; `NOT_ENOUGH_EVIDENCE` entries never become the headline. */
  trendStories: PlayerTrendStory[];
  /** `null` when no automatic position-profile-evolution record exists, or when one exists but
   * is no longer current (see `player-detail-production-adapter.ts`'s own recency/supersession
   * gate -- that gating is data-freshness logic, not "which candidate wins," so it lives there,
   * not here). */
  positionEvolution: PlayerPositionEvolutionStorySource | null;
  activeDevelopmentFocus: PlayerDevelopmentFocusStorySource | null;
  recentOpportunity: PlayerRecentOpportunityInput | null;
};

/** Trend metrics in the order this selector prefers them when more than one has a material
 * (non-STABLE) direction -- role/game-state exposure is the player's own on-pitch story;
 * co-presence stays last (ADR-0155 §9: exposure only, never elevated above the player's own
 * role story). Mirrors `get-player-trend-stories.ts`'s own `METRIC_HEADLINE_PRIORITY` ordering
 * intent; kept as a separate, smaller table here since this selector only needs an ordinal, not
 * the full metric metadata that module owns. */
const METRIC_PRIORITY_ORDER: Record<string, number> = {
  role_seconds: 0,
  game_state_role_seconds: 1,
  event_rate: 2,
  zone_event_share: 3,
  zone_event_count: 3,
  event_count: 4,
  teammate_copresence_seconds: 5,
};

const MINIMUM_OPPORTUNITY_SAMPLE = 3;

export function selectPlayerCurrentStory(input: PlayerCurrentStoryInput): PlayerCurrentStory | null {
  const trend = selectMostMaterialTrend(input.trendStories);
  if (trend) return { text: trend.headline, source: "TREND" };

  if (input.positionEvolution) {
    const { newPrimaryLabel, previousPrimaryLabel } = input.positionEvolution;
    const text = previousPrimaryLabel
      ? `Recorded primary position updated to ${newPrimaryLabel} based on recent match evidence (previously ${previousPrimaryLabel}).`
      : `Recorded primary position updated to ${newPrimaryLabel} based on recent match evidence.`;
    return { text, source: "POSITION_EVOLUTION" };
  }

  if (input.activeDevelopmentFocus?.hasRecentSupportingObservation) {
    return {
      text: `Development focus on ${input.activeDevelopmentFocus.focus} has a recent supporting observation.`,
      source: "DEVELOPMENT_FOCUS",
    };
  }

  const opportunityText = selectOpportunityException(input.recentOpportunity);
  if (opportunityText) return { text: opportunityText, source: "OPPORTUNITY" };

  return null;
}

function selectMostMaterialTrend(trendStories: readonly PlayerTrendStory[]): Extract<PlayerTrendStory, { kind: "TREND" }> | null {
  const candidates = trendStories.filter(
    (story): story is Extract<PlayerTrendStory, { kind: "TREND" }> => story.kind === "TREND" && story.direction !== "STABLE",
  );
  if (candidates.length === 0) return null;

  const sorted = [...candidates].sort((a, b) => {
    const priorityA = METRIC_PRIORITY_ORDER[a.metricKey] ?? 99;
    const priorityB = METRIC_PRIORITY_ORDER[b.metricKey] ?? 99;
    if (priorityA !== priorityB) return priorityA - priorityB;
    if (b.materialityRatio !== a.materialityRatio) return b.materialityRatio - a.materialityRatio;
    // Final deterministic tiebreak -- never leaves selection order to object/Map iteration order.
    return JSON.stringify(a.dimensions).localeCompare(JSON.stringify(b.dimensions));
  });
  return sorted[0]!;
}

/**
 * "A current opportunity exception relevant to near-term planning" -- the two honestly-notable
 * edges of the recent-opportunity pattern: a full recent streak, or a complete recent gap. A
 * partial ratio (e.g. 3 of 5) is unremarkable and never becomes a headline on its own; it still
 * renders in the Overview's own compact opportunity widget regardless.
 */
function selectOpportunityException(opportunity: PlayerRecentOpportunityInput | null): string | null {
  if (!opportunity || opportunity.recentTotal < MINIMUM_OPPORTUNITY_SAMPLE) return null;
  if (opportunity.recentCount === opportunity.recentTotal) {
    return `Recent opportunities have been consistent: ${opportunity.recentCount} of ${opportunity.recentTotal} eligible rounds.`;
  }
  if (opportunity.recentCount === 0) {
    return `No planned opportunity in the last ${opportunity.recentTotal} eligible rounds.`;
  }
  return null;
}
