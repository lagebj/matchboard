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
