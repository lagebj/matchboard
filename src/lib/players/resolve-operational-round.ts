import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { getDisplayIsoWeekKey } from "@/lib/date-utils";

/**
 * Fixes the Players route's operational/current-round default (Matchboard Players Operating
 * Surface bundle, `06_EXACT_CODE_EXECUTION_PLAN.md` step 9 / `08_TEST_AND_ACCEPTANCE_MATRIX.md`
 * §D). The previous implementation defaulted to the first `MatchRound` returned by the DB when
 * no `roundId` query parameter was present — an arbitrary ordering artifact, never a temporal
 * fact. This module resolves the round that is genuinely "current" from real kickoff dates,
 * reusing the same display-week semantics the League route's focused-round resolution already
 * established (`getDisplayIsoWeekKey()`, Europe/Oslo display calendar, ADR-0137/ADR-0141) —
 * never a second timezone or "current" policy.
 */

export type RoundKickoffs = {
  roundId: string;
  /** Kickoff instants for this round's non-cancelled matches only. */
  kickoffs: Date[];
};

/**
 * Pure decision function, DB-free and directly unit-testable. Given each candidate round's
 * non-cancelled match kickoffs, resolves the single "current" round:
 *
 * 1. current display-week round (any kickoff falls in `now`'s display week);
 * 2. if multiple rounds qualify, the one with the earliest kickoff;
 * 3. otherwise the future round with the earliest kickoff;
 * 4. otherwise the past round with the latest kickoff;
 * 5. otherwise `undefined` — round name is never used as a temporal fallback.
 */
export function computeDefaultOperationalRoundId(rounds: RoundKickoffs[], now: Date = new Date()): string | undefined {
  const nowWeekKey = getDisplayIsoWeekKey(now);

  const scheduled = rounds.filter((r) => r.kickoffs.length > 0);
  if (scheduled.length === 0) return undefined;

  const withEarliest = scheduled.map((r) => ({
    roundId: r.roundId,
    earliestKickoff: new Date(Math.min(...r.kickoffs.map((d) => d.getTime()))),
    latestKickoff: new Date(Math.max(...r.kickoffs.map((d) => d.getTime()))),
    weekKeys: new Set(r.kickoffs.map((d) => getDisplayIsoWeekKey(d))),
  }));

  const current = withEarliest.filter((r) => r.weekKeys.has(nowWeekKey));
  if (current.length > 0) {
    const sorted = [...current].sort((a, b) => a.earliestKickoff.getTime() - b.earliestKickoff.getTime());
    return sorted[0].roundId;
  }

  const future = withEarliest.filter((r) => r.earliestKickoff.getTime() > now.getTime());
  if (future.length > 0) {
    const sorted = [...future].sort((a, b) => a.earliestKickoff.getTime() - b.earliestKickoff.getTime());
    return sorted[0].roundId;
  }

  const past = withEarliest.filter((r) => r.latestKickoff.getTime() < now.getTime());
  if (past.length > 0) {
    const sorted = [...past].sort((a, b) => b.latestKickoff.getTime() - a.latestKickoff.getTime());
    return sorted[0].roundId;
  }

  return undefined;
}

/**
 * DB-bound wrapper: loads non-cancelled match kickoffs for the given candidate round IDs and
 * resolves the default operational round through the pure decision function above. Cancelled
 * matches never make a round current — excluded at the query level (`status: { not: "CANCELLED" }`).
 */
export async function resolveDefaultOperationalRoundId(
  candidateRoundIds: string[],
  orgFilter: OrgFilterMode,
  now: Date = new Date(),
): Promise<string | undefined> {
  if (orgFilter.type !== "org" || candidateRoundIds.length === 0) return undefined;

  const matches = await db.match.findMany({
    where: {
      matchRoundId: { in: candidateRoundIds },
      organisationId: orgFilter.organisationId,
      status: { not: "CANCELLED" },
    },
    select: { matchRoundId: true, startsAt: true },
  });

  const kickoffsByRound = new Map<string, Date[]>();
  for (const m of matches) {
    const list = kickoffsByRound.get(m.matchRoundId) ?? [];
    list.push(m.startsAt);
    kickoffsByRound.set(m.matchRoundId, list);
  }

  const rounds: RoundKickoffs[] = candidateRoundIds.map((roundId) => ({
    roundId,
    kickoffs: kickoffsByRound.get(roundId) ?? [],
  }));

  return computeDefaultOperationalRoundId(rounds, now);
}
