/**
 * Canonical identity for a match that can contribute post-match learning evidence.
 * See ADR-0104 (Canonical Post-Match Learning Pipeline).
 *
 * Evidence algorithms accept this ref instead of a raw League `matchId` so they stop
 * branching on persistence details — adapters (`./adapters/*`) build it and resolve
 * source-specific data; the shared orchestrator (`./post-match-learning.ts`) and the
 * generalized evidence functions consume it uniformly.
 */
export type FootballMatchRef =
  | {
      kind: "LEAGUE_MATCH";
      matchId: string;
      /** Resolved via the match's round; null if no round/season chain resolves. */
      leagueSeasonId: string | null;
    }
  | {
      kind: "EVENT_MATCH";
      eventMatchId: string;
      eventId: string;
      /**
       * Learning context only — never League competition membership. Resolved from
       * football-group + date-range overlap; null when no single League season applies
       * (combination evidence is then skipped with reason `NO_EVIDENCE_SEASON`).
       */
      evidenceLeagueSeasonId: string | null;
    };

export function footballMatchRefSourceId(ref: FootballMatchRef): string {
  return ref.kind === "LEAGUE_MATCH" ? ref.matchId : ref.eventMatchId;
}

export function footballMatchRefEvidenceLeagueSeasonId(ref: FootballMatchRef): string | null {
  return ref.kind === "LEAGUE_MATCH" ? ref.leagueSeasonId : ref.evidenceLeagueSeasonId;
}

/**
 * Resolves a bare id to its `FootballMatchRef` without the caller having to already know
 * whether it names a League `Match` or an `EventMatch` -- needed by any consumer (the AI
 * Advisor's `MATCH`-scoped capabilities, `context/*.ts`) that only has an opaque
 * `AiAdvisorJob.scopeId`/`AiAdvisorReview.scopeId` string, because `AiAdvisorScopeType.MATCH`
 * deliberately does not distinguish League from Event (06_AI_CAPABILITY_CONTRACTS.md
 * "post_match_review": "League and Event matches normalize into the same AI contract"). Tries
 * League first, then Event; returns `null` if neither table has a row with this id (the scope
 * no longer exists).
 */
export async function resolveFootballMatchRefById(id: string): Promise<FootballMatchRef | null> {
  const { db } = await import("@/lib/db");

  const leagueMatch = await db.match.findUnique({ where: { id }, select: { id: true } });
  if (leagueMatch) {
    const { buildLeagueMatchRef } = await import("./adapters/league-evidence-adapter");
    return buildLeagueMatchRef(id);
  }

  const eventMatch = await db.eventMatch.findUnique({ where: { id }, select: { id: true } });
  if (eventMatch) {
    const { buildEventMatchRef } = await import("./adapters/event-evidence-adapter");
    return buildEventMatchRef(id);
  }

  return null;
}
