import { db } from "@/lib/db";
import type { FootballMatchRef } from "../football-match-ref";

/**
 * Builds the canonical ref for an Event match, resolving its evidence league season by
 * matching the Event's football group + match date against League season date ranges
 * (learning context only -- never League competition membership, see ADR-0104 section 9).
 *
 * - Exactly one applicable League season: use it.
 * - Zero or several (ambiguous) applicable seasons: leave null. Combination evidence is
 *   then skipped with reason `NO_EVIDENCE_SEASON` -- never guessed.
 */
export async function buildEventMatchRef(eventMatchId: string): Promise<FootballMatchRef> {
  const eventMatch = await db.eventMatch.findUnique({
    where: { id: eventMatchId },
    select: {
      eventId: true,
      startsAt: true,
      event: { select: { footballGroupId: true } },
    },
  });

  if (!eventMatch) {
    return { kind: "EVENT_MATCH", eventMatchId, eventId: "", evidenceLeagueSeasonId: null };
  }

  const candidateSeasons = await db.leagueSeason.findMany({
    where: {
      footballGroupId: eventMatch.event.footballGroupId,
      startDate: { lte: eventMatch.startsAt },
      endDate: { gte: eventMatch.startsAt },
    },
    select: { id: true },
  });

  const evidenceLeagueSeasonId = candidateSeasons.length === 1 ? candidateSeasons[0].id : null;

  return { kind: "EVENT_MATCH", eventMatchId, eventId: eventMatch.eventId, evidenceLeagueSeasonId };
}
