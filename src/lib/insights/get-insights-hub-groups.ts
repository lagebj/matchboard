import type { InsightOverview } from "@/lib/insights/insights-types";

/**
 * Insights hub grouping (Touchline Design Atlas, `07_ROUTE_COMPOSITION_PLAYERS_INSIGHTS.md §C`):
 * "Do not create a metrics dashboard of equal cards" — four named narrative sections, not a flat
 * list of equal-weight surface cards. Pure, DB-free: takes the already-loaded card metadata and
 * the already-fetched `InsightOverview` (existing `/api/insights/overview`, no new query) and
 * produces the four groups plus an optional single "spotlight" headline number per group, reusing
 * fields the overview endpoint already computes rather than fetching per-group evidence.
 *
 * Two groups (Roles & development, Match patterns) have no existing InsightOverview field that
 * maps to their theme — `getGroupSpotlightValue()` returns null for those rather than fabricating
 * a number. See the provenance doc for the disclosed reason.
 */
export type InsightGroupId = "opportunity-load" | "roles-development" | "match-patterns" | "planning-quality";

export interface InsightCardMeta {
  id: string;
  href: string;
  label: string;
  description: string;
  group: InsightGroupId;
}

/** Card → group assignment follows the spec's own "primary from" lists verbatim. */
export const INSIGHT_CARDS: InsightCardMeta[] = [
  // 1. Opportunity & load — opportunity; opportunity gap; load; coverage.
  { id: "opportunity", href: "/insights/opportunity", label: "Opportunity Matrix", description: "Player participation by round — who gets match opportunities, who doesn't, and why", group: "opportunity-load" },
  { id: "opportunity-quality", href: "/insights/opportunity-quality", label: "Opportunity Quality", description: "Factual context for every planned opportunity — team, role, position, and realised attendance", group: "opportunity-load" },
  { id: "opportunity-gap", href: "/insights/opportunity-gap", label: "Opportunity Gap", description: "Planned vs realised opportunity over a period — descriptive, not a debt score", group: "opportunity-load" },
  { id: "load", href: "/insights/load", label: "Load Timeline", description: "Match load per player over time — identify high recent load and rest patterns", group: "opportunity-load" },
  { id: "coverage", href: "/insights/coverage", label: "Squad Coverage", description: "Goalkeeper and position coverage per squad — spot structural gaps before matchday", group: "opportunity-load" },
  // 2. Roles & development — position exposure; pathways; continuity.
  { id: "position-exposure", href: "/insights/position-exposure", label: "Position & Formation Exposure", description: "Planned lineup slots and realised positions per player — unused assignments don't count", group: "roles-development" },
  { id: "player-pathways", href: "/insights/player-pathways", label: "Player Pathways", description: "Season matrix, context transitions, and fairness overview across rounds", group: "roles-development" },
  { id: "continuity", href: "/insights/continuity", label: "Continuity vs Exploration", description: "Round-over-round retained vs new players and formation repeats per team", group: "roles-development" },
  // 3. Match patterns — phase patterns; combinations; opponent context where available.
  { id: "match-phase-patterns", href: "/insights/match-phase-patterns", label: "Match Timing Patterns", description: "Repeated goal patterns by match phase (opening minutes, late period) — descriptive, with confidence", group: "match-patterns" },
  { id: "player-combinations", href: "/insights/player-combinations", label: "Player Combinations", description: "Co-selection and co-appearance frequency between players — frequency is not effectiveness", group: "match-patterns" },
  // 4. Planning quality — planned vs actual; policy warnings; conflicts; operational health.
  { id: "planned-vs-actual", href: "/insights/planned-vs-actual", label: "Planned vs Actual", description: "Compare planned squads with actual participation — unplanned additions, absences, role changes", group: "planning-quality" },
  { id: "policy-warnings", href: "/insights/policy-warnings", label: "Policy Warning Review", description: "Blocked conditions, decision-required flags, and planning notes from policy evaluation", group: "planning-quality" },
  { id: "conflicts", href: "/insights/conflicts", label: "Conflict Review", description: "Overlapping selections, helper conflicts, and double-planned players across rounds", group: "planning-quality" },
  { id: "operational-health", href: "/insights/operational-health", label: "Operational Health", description: "Concrete grouped facts about planning state — incomplete lineups, missing reports, stale assignments", group: "planning-quality" },
];

export const INSIGHT_GROUP_TITLES: Record<InsightGroupId, string> = {
  "opportunity-load": "Opportunity & load",
  "roles-development": "Roles & development",
  "match-patterns": "Match patterns",
  "planning-quality": "Planning quality",
};

export const INSIGHT_GROUP_ORDER: InsightGroupId[] = [
  "opportunity-load",
  "roles-development",
  "match-patterns",
  "planning-quality",
];

export interface InsightGroupDefinition {
  id: InsightGroupId;
  title: string;
  cards: InsightCardMeta[];
}

export function groupInsightCards(cards: InsightCardMeta[]): InsightGroupDefinition[] {
  return INSIGHT_GROUP_ORDER.map((id) => ({
    id,
    title: INSIGHT_GROUP_TITLES[id],
    cards: cards.filter((c) => c.group === id),
  }));
}

export interface InsightGroupSpotlight {
  /** Quiet uppercase group label for EvidenceSpotlightWidget's own `label` slot. */
  label: string;
  /** Factual headline sentence for EvidenceSpotlightWidget's own `title` slot. */
  title: string;
  value: number;
}

/**
 * One headline number per group, reused from the already-fetched `InsightOverview` — never a
 * new query. Returns null where no existing overview field maps to the group's theme (a real,
 * disclosed gap, not silently invented).
 */
export function getGroupSpotlightValue(groupId: InsightGroupId, overview: InsightOverview | null): InsightGroupSpotlight | null {
  if (!overview) return null;
  switch (groupId) {
    case "opportunity-load": {
      const n = overview.playersWithNoOpportunity;
      return {
        label: "Players with no opportunity",
        title: n === 1 ? "1 player has no planned opportunity" : `${n} players have no planned opportunity`,
        value: n,
      };
    }
    case "planning-quality": {
      const n = overview.policyWarningsCount;
      return {
        label: "Policy warnings",
        title: n === 1 ? "1 active policy warning" : `${n} active policy warnings`,
        value: n,
      };
    }
    case "roles-development":
    case "match-patterns":
      return null;
  }
}
