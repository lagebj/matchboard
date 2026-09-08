import "server-only";

import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { resolveActiveLeagueSeason } from "@/app/(app)/o/[orgSlug]/rounds/build-round-item";

/**
 * Player recent-opportunity evidence (ADR-0125 — the recent-opportunity MetricStory).
 *
 * "Has this player had regular recent match opportunity?" — measured only over rounds in which
 * the player is canonically eligible for opportunity: their **core team** (authoritative
 * `Player.coreTeamId`, per AGENTS.md's `AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY` rule) has
 * at least one non-cancelled match in the round. "Had opportunity" = a planned `Selection` for
 * the player in that round (DRAFT or FINALIZED — a draft plan is still a planned opportunity).
 * Nothing here is a new metric; it reads existing `MatchRound`/`Match`/`Selection` facts.
 */
export type PlayerRecentOpportunity = {
  /** Oldest → newest, capped at the last 10 eligible rounds. */
  perRound: { roundLabel: string; hadOpportunity: boolean }[];
  /** Opportunity count / eligible-round count over the last 5 eligible rounds. */
  recentCount: number;
  recentTotal: number;
  /** The 5 eligible rounds before those, when at least 3 exist (else null). */
  previousCount: number | null;
  previousTotal: number | null;
};

export async function getPlayerRecentOpportunity(
  playerId: string,
): Promise<PlayerRecentOpportunity | null> {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);
  const orgId = ctx.organisationId;

  const player = await db.player.findFirst({
    where: { id: playerId, organisationId: orgId },
    select: { coreTeamId: true, coreTeam: { select: { footballGroupId: true } } },
  });
  if (!player?.coreTeamId || !player.coreTeam?.footballGroupId) return null;

  const seasons = await db.leagueSeason.findMany({
    where: { footballGroupId: player.coreTeam.footballGroupId, organisationId: orgId },
    select: { id: true, name: true, startDate: true, endDate: true },
  });
  const season = resolveActiveLeagueSeason(seasons, new Date());
  if (!season) return null;

  const roundRows = await db.matchRound.findMany({
    where: {
      leagueSeasonId: season.id,
      organisationId: orgId,
      matches: { some: { teamId: player.coreTeamId, status: { not: "CANCELLED" } } },
    },
    select: {
      id: true,
      name: true,
      matches: { select: { startsAt: true }, orderBy: { startsAt: "asc" }, take: 1 },
    },
  });
  if (roundRows.length === 0) return null;

  // MatchRound carries no date of its own — order rounds by their earliest match kickoff.
  const rounds = roundRows
    .map((r) => ({ id: r.id, name: r.name, sortKey: r.matches[0]?.startsAt?.getTime() ?? 0 }))
    .sort((a, b) => a.sortKey - b.sortKey);

  const selections = await db.selection.findMany({
    where: {
      playerId,
      organisationId: orgId,
      matchRoundId: { in: rounds.map((r) => r.id) },
    },
    select: { matchRoundId: true },
  });
  const roundsWithOpportunity = new Set(selections.map((s) => s.matchRoundId));

  const eligible = rounds.map((r) => ({
    roundLabel: r.name,
    hadOpportunity: roundsWithOpportunity.has(r.id),
  }));

  const perRound = eligible.slice(-10);
  const last5 = eligible.slice(-5);
  const prev5 = eligible.slice(-10, -5);

  return {
    perRound,
    recentCount: last5.filter((e) => e.hadOpportunity).length,
    recentTotal: last5.length,
    previousCount: prev5.length >= 3 ? prev5.filter((e) => e.hadOpportunity).length : null,
    previousTotal: prev5.length >= 3 ? prev5.length : null,
  };
}
