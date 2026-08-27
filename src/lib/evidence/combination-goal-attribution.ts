import { db } from "@/lib/db";

/**
 * A single team goal, placed on the match timeline where precision allows.
 *
 * Team goals (for/against) and player attribution come from different canonical sources with
 * different guarantees:
 * - `Goal`/`Assist` (from `PostMatchReport`) are the canonical scorer/assist truth (see
 *   AGENTS.md "Canonical data truth"), but `Assist` carries no timestamp or goal linkage at all,
 *   and `Goal.minute` is coach-entered and only minute-precision.
 * - `LiveMatchEvent` rows (GOAL_FOR/GOAL_AGAINST/SCORER_SET/ASSIST_SET) carry exact
 *   `matchSeconds` when the match was live-recorded, but are a live-session projection, not the
 *   report's own canonical scorer/assist fields.
 *
 * This module only ever READS these sources to place goals on the timeline for combination
 * evidence — it never writes Goal/Assist/LiveMatchEvent, and it never invents timing precision
 * that neither source actually has.
 */
export type GoalAttributionEvent = {
  matchMs: number;
  team: "FOR" | "AGAINST";
  scorerPlayerId: string | null;
  assistPlayerId: string | null;
  approximateTiming: boolean;
};

const GOAL_ASSIST_PAIRING_WINDOW_MS = 60_000;

export async function getGoalAttributionEvents(matchId: string): Promise<GoalAttributionEvent[]> {
  const liveGoalEvents = await db.liveMatchEvent.findMany({
    where: {
      matchId,
      eventType: { in: ["GOAL_FOR", "GOAL_AGAINST", "SCORER_SET", "ASSIST_SET"] },
      OR: [{ correctionType: null }, { correctionType: "CORRECTION" }],
    },
    select: { eventType: true, playerId: true, matchSeconds: true },
    orderBy: { createdAt: "asc" },
  });

  const hasLiveGoalEvents = liveGoalEvents.some(
    (e) => (e.eventType === "GOAL_FOR" || e.eventType === "GOAL_AGAINST") && e.matchSeconds !== null,
  );

  if (hasLiveGoalEvents) {
    return deriveFromLiveEvents(liveGoalEvents);
  }

  return deriveFromReportGoals(matchId);
}

function deriveFromLiveEvents(
  events: { eventType: string; playerId: string | null; matchSeconds: number | null }[],
): GoalAttributionEvent[] {
  const scorerEvents = events.filter((e) => e.eventType === "SCORER_SET" && e.playerId && e.matchSeconds !== null);
  const assistEvents = events.filter((e) => e.eventType === "ASSIST_SET" && e.playerId && e.matchSeconds !== null);
  const claimedScorers = new Set<number>();
  const claimedAssists = new Set<number>();

  const nearestUnclaimed = (
    pool: { playerId: string | null; matchSeconds: number | null }[],
    claimed: Set<number>,
    atMs: number,
  ): string | null => {
    let bestIndex = -1;
    let bestDelta = Infinity;
    for (let i = 0; i < pool.length; i++) {
      if (claimed.has(i)) continue;
      const delta = Math.abs((pool[i]!.matchSeconds ?? 0) * 1000 - atMs);
      if (delta <= GOAL_ASSIST_PAIRING_WINDOW_MS && delta < bestDelta) {
        bestDelta = delta;
        bestIndex = i;
      }
    }
    if (bestIndex === -1) return null;
    claimed.add(bestIndex);
    return pool[bestIndex]!.playerId;
  };

  const results: GoalAttributionEvent[] = [];

  for (const event of events) {
    if (event.eventType !== "GOAL_FOR" && event.eventType !== "GOAL_AGAINST") continue;
    if (event.matchSeconds === null) continue;

    const matchMs = event.matchSeconds * 1000;
    const team = event.eventType === "GOAL_FOR" ? "FOR" : "AGAINST";

    results.push({
      matchMs,
      team,
      scorerPlayerId: team === "FOR" ? nearestUnclaimed(scorerEvents, claimedScorers, matchMs) : null,
      assistPlayerId: team === "FOR" ? nearestUnclaimed(assistEvents, claimedAssists, matchMs) : null,
      approximateTiming: false,
    });
  }

  return results;
}

async function deriveFromReportGoals(matchId: string): Promise<GoalAttributionEvent[]> {
  const report = await db.postMatchReport.findFirst({
    where: { matchId },
    select: { id: true, goals: { where: { minute: { not: null } }, select: { playerId: true, minute: true } } },
  });

  if (!report) return [];

  // Assist has no timestamp or goal linkage in the canonical schema (see AGENTS.md "Canonical
  // data truth") — direct assist contribution cannot be time-correlated to a segment from this
  // source. Leaving assistPlayerId null here is the honest "unknown", not a guess.
  return report.goals.map((g) => ({
    matchMs: g.minute! * 60_000,
    team: "FOR" as const,
    scorerPlayerId: g.playerId,
    assistPlayerId: null,
    approximateTiming: true,
  }));
}
