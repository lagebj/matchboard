export type MatchWithDate = {
  startsAt: Date | null;
  matchDurationMinutes: number | null;
  status?: string | null;
};

export type LeagueMatchWithDate = {
  startsAt: Date | null;
  status?: string | null;
};

export function hasMatchPassed(match: MatchWithDate, now?: Date): boolean {
  if (match.status === "CANCELLED") return false;
  if (!match.startsAt) return false;

  const referenceDate = now ?? new Date();
  const startsAt = match.startsAt instanceof Date ? match.startsAt : new Date(match.startsAt);

  if (match.matchDurationMinutes != null && match.matchDurationMinutes > 0) {
    const endsAt = new Date(startsAt.getTime() + match.matchDurationMinutes * 60 * 1000);
    return referenceDate >= endsAt;
  }

  const startDay = new Date(startsAt.getFullYear(), startsAt.getMonth(), startsAt.getDate());
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  return today > startDay;
}

export function hasLeagueMatchPassed(match: LeagueMatchWithDate, now?: Date): boolean {
  if (match.status === "CANCELLED") return false;
  if (!match.startsAt) return false;

  const referenceDate = now ?? new Date();
  const startsAt = match.startsAt instanceof Date ? match.startsAt : new Date(match.startsAt);
  const matchDay = new Date(startsAt.getFullYear(), startsAt.getMonth(), startsAt.getDate());
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  return today > matchDay;
}