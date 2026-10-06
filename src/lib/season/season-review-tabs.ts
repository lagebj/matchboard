import type { TabItem } from "@/components/ui/tab-rail";

/**
 * Season Review local tabs (ADR-0157 slice C7, `09_SEASON_REVIEW.md` "Target local tabs").
 * Mirrors `match-detail-tabs.ts`'s one-module-owns-the-tab-set discipline: Season Review's
 * `?tab=` query param is resolved only here, so the page, the tab rail, and any deep link
 * cannot drift apart.
 *
 * These are local tabs on the existing `/season` route (reframed as Season Review) — never a
 * primary navigation item (ADR-0157 §6: "Reached from League, never a fifth primary nav item").
 */

export type SeasonReviewTabKey = "overview" | "teams" | "players" | "development" | "opportunity";

const SEASON_REVIEW_TABS: TabItem<SeasonReviewTabKey>[] = [
  { key: "overview", label: "Overview" },
  { key: "teams", label: "Teams" },
  { key: "players", label: "Players" },
  { key: "development", label: "Development" },
  { key: "opportunity", label: "Opportunity" },
];

const SEASON_REVIEW_DEFAULT_TAB: SeasonReviewTabKey = "overview";

export function getSeasonReviewTabs(): TabItem<SeasonReviewTabKey>[] {
  return SEASON_REVIEW_TABS;
}

export function getSeasonReviewDefaultTab(): SeasonReviewTabKey {
  return SEASON_REVIEW_DEFAULT_TAB;
}

/** Resolves an untrusted `?tab=` value against the real tab set — an unknown/missing value
 * falls back to Overview rather than rendering empty content, matching
 * `resolveMatchDetailTab()`'s own fallback discipline. */
export function resolveSeasonReviewTab(requestedTab: string | null | undefined): SeasonReviewTabKey {
  const match = SEASON_REVIEW_TABS.find((t) => t.key === requestedTab);
  return match ? match.key : SEASON_REVIEW_DEFAULT_TAB;
}
