/**
 * Issue #686 / ADR-0158 slice 3: combines League's and Event's independently-sorted
 * `TodayLiveNowResult`s into the one Live Now slot Today renders. Each source has already picked
 * its own best candidate (situational active match first, else earliest kickoff) over its own
 * set — comparing those two already-best candidates with the same rule picks the best overall
 * (the max of the union of two sets equals the max of their two maxes), so this never needs the
 * two sources' full unsorted lists, only what each already returns.
 */

import { getTodayLiveMatchSummaries, type TodayLiveNowResult } from "@/lib/live-match/get-today-live-match-summaries";
import { getTodayEventLiveMatchSummaries } from "@/lib/live-match/get-today-event-live-match-summaries";

export async function getTodayLiveNow(
  organisationId: string,
  leagueCandidateMatchIds: string[],
  activeMatchId: string | undefined,
  now: Date = new Date(),
): Promise<TodayLiveNowResult> {
  const [league, event] = await Promise.all([
    getTodayLiveMatchSummaries(organisationId, leagueCandidateMatchIds, activeMatchId, now),
    getTodayEventLiveMatchSummaries(organisationId, activeMatchId, now),
  ]);

  if (!league.primary) return event;
  if (!event.primary) return league;

  const leagueWins =
    activeMatchId && league.primary.matchId === activeMatchId
      ? true
      : activeMatchId && event.primary.matchId === activeMatchId
        ? false
        : league.primary.startsAtIso <= event.primary.startsAtIso;

  return leagueWins
    ? { primary: league.primary, otherLiveCount: league.otherLiveCount + 1 + event.otherLiveCount }
    : { primary: event.primary, otherLiveCount: event.otherLiveCount + 1 + league.otherLiveCount };
}
