import { getDisplayDateKey } from "@/lib/date-utils";

export type MatchWithDate = {
  startsAt: Date | null;
  matchDurationMinutes: number | null;
  status?: string | null;
};

export type LeagueMatchWithDate = {
  startsAt: Date | null;
  status?: string | null;
};

/**
 * Day-boundary comparisons below resolve "today" and the match's calendar day against the
 * canonical `MATCHBOARD_DISPLAY_TIMEZONE` (Europe/Oslo, ADR-0137) via `getDisplayDateKey()`,
 * not the JS runtime's own local getters (`getFullYear`/`getMonth`/`getDate`). Those getters
 * resolve against whichever timezone the *executing process* happens to be configured with —
 * correct only by coincidence, and a real risk for any match whose `startsAt` still carries
 * ARR-0044's historical write-side skew (up to a couple of hours), since that skew can push a
 * late-evening kickoff across a runtime-local (but not real Europe/Oslo) midnight boundary.
 * Reusing `getDisplayDateKey()` keeps this the one documented timezone policy in the codebase —
 * never a second one.
 */
function isAfterDisplayDay(reference: Date, boundary: Date): boolean {
  return getDisplayDateKey(reference) > getDisplayDateKey(boundary);
}

export function hasMatchPassed(match: MatchWithDate, now?: Date): boolean {
  if (match.status === "CANCELLED") return false;
  if (!match.startsAt) return false;

  const referenceDate = now ?? new Date();
  const startsAt = match.startsAt instanceof Date ? match.startsAt : new Date(match.startsAt);

  if (match.matchDurationMinutes != null && match.matchDurationMinutes > 0) {
    const endsAt = new Date(startsAt.getTime() + match.matchDurationMinutes * 60 * 1000);
    return referenceDate >= endsAt;
  }

  return isAfterDisplayDay(referenceDate, startsAt);
}

export function hasLeagueMatchPassed(match: LeagueMatchWithDate, now?: Date): boolean {
  if (match.status === "CANCELLED") return false;
  if (!match.startsAt) return false;

  const referenceDate = now ?? new Date();
  const startsAt = match.startsAt instanceof Date ? match.startsAt : new Date(match.startsAt);
  return isAfterDisplayDay(referenceDate, startsAt);
}