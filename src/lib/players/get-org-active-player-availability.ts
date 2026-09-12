import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

/**
 * Org-wide active player availability (`Player.currentAvailability`) — no round/team scoping.
 * Feeds the Today squad-status widget (Touchline Design Atlas, `05_ROUTE_COMPOSITION_TODAY_LEAGUE_HISTORY.md §A`),
 * which asks "how many of the coach's players, across every team, are currently available"
 * rather than a specific round's plan-integrity state (that remains
 * `getPlayersCurrentRoundAttention()`'s job — a different question, round-scoped).
 *
 * Reuses the exact same active-org-player query shape `getPlayersSeasonOverview()`
 * (`src/lib/players/get-players-overview.ts`) already uses, minus the round/season machinery
 * this widget doesn't need.
 */
export type OrgPlayerAvailabilityRow = {
  playerId: string;
  displayName: string;
  availability: "AVAILABLE" | "UNAVAILABLE" | "INJURED" | "SICK" | "AWAY" | "TENTATIVE" | "UNKNOWN";
};

export async function getOrgActivePlayerAvailability(orgFilter: OrgFilterMode): Promise<OrgPlayerAvailabilityRow[]> {
  const orgWhere = orgFilter.type === "org" ? orgFilter.filter : {};

  const players = await db.player.findMany({
    where: { active: true, removedAt: null, ...orgWhere },
    select: { id: true, firstName: true, lastName: true, currentAvailability: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  return players.map((p) => ({
    playerId: p.id,
    displayName: p.lastName ? `${p.firstName} ${p.lastName}` : p.firstName,
    availability: p.currentAvailability,
  }));
}
