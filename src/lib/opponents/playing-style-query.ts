import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import {
  aggregatePlayingStyleTendencies,
  deriveOpponentTendencyOutcomes,
  type OpponentTacticalTendency,
  type OpponentTendencyOutcome,
} from "@/lib/opponents/playing-style-aggregation";

/**
 * Coach-facing tactical tendencies for one opponent, aggregated from every recorded
 * `OpponentEncounterObservation.playingStyleTags` for that opponent (League matches only —
 * see `playing-style-aggregation.ts`). Returns `[]` for an opponent with no observations yet,
 * never throws.
 */
export async function getOpponentTacticalTendencies(
  opponentTeamId: string,
  orgFilter: OrgFilterMode,
): Promise<OpponentTacticalTendency[]> {
  if (orgFilter.type !== "org") return [];

  const observations = await db.opponentEncounterObservation.findMany({
    where: { opponentTeamId, ...orgFilter.filter },
    select: {
      matchId: true,
      playingStyleTags: true,
      match: { select: { startsAt: true } },
    },
  });

  const inputs = observations
    .filter((o) => o.playingStyleTags.length > 0)
    .map((o) => ({
      matchId: o.matchId,
      occurredAt: o.match.startsAt,
      playingStyleTags: o.playingStyleTags,
    }));

  return aggregatePlayingStyleTendencies(opponentTeamId, inputs);
}

/**
 * "Our response to opponent tendencies" (PROGRAMME.md) for one opponent — factual goals
 * for/against across the matches behind each non-insufficient tendency. Reuses the canonical
 * `OpponentSportingEvidence.goalsFor/goalsAgainst` already recorded per match by the shared
 * post-match learning pipeline (ADR-0104) rather than re-deriving score facts here.
 */
export async function getOpponentTendencyOutcomes(
  opponentTeamId: string,
  orgFilter: OrgFilterMode,
): Promise<OpponentTendencyOutcome[]> {
  if (orgFilter.type !== "org") return [];

  const tendencies = await getOpponentTacticalTendencies(opponentTeamId, orgFilter);
  if (tendencies.length === 0) return [];

  const matchIds = [...new Set(tendencies.flatMap((t) => t.sourceMatchIds))];

  const evidenceRows = await db.opponentSportingEvidence.findMany({
    where: { matchId: { in: matchIds }, ...orgFilter.filter },
    select: { matchId: true, goalsFor: true, goalsAgainst: true },
  });

  const outcomesByMatchId = new Map(
    evidenceRows
      .filter((r): r is typeof r & { matchId: string } => r.matchId !== null)
      .map((r) => [r.matchId, { goalsFor: r.goalsFor, goalsAgainst: r.goalsAgainst }]),
  );

  return deriveOpponentTendencyOutcomes(tendencies, outcomesByMatchId);
}
