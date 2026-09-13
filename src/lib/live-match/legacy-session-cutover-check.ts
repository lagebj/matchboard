// Deliberately no `import "server-only"` — this diagnostic runs both from Next.js server code
// and from a plain-Node CLI script (`scripts/live-diagnostics.ts`), matching
// `projection-divergence-diagnostic.ts`'s own reasoning.
import { db } from "@/lib/db";
import { runWithSystemPrivilege } from "@/lib/tenancy/tenant-async-storage";

/**
 * ADR-0138 Bundle 9 (OBSERVABILITY_RECOVERY_ROLLOUT.md §8's cutover checklist: "No active
 * legacy League sessions" / "No active legacy Event sessions"). A "legacy" session here is one
 * with at least one recorded event predating the persisted canonical `sequence` column (Bundle
 * 2) — i.e. at least one event with `sequence: null` — meaning some of that session's history
 * was never assigned a coordinator-ordered position. This never happens for a session created
 * after Bundle 2/4/8 shipped (every accepted event is always sequence-assigned today); it can
 * only be true for a session that has been continuously ACTIVE since before this migration.
 *
 * This function only *reports* such sessions — it never ends them, never mutates them, and
 * never runs the sequence backfill itself (`scripts/backfill-live-event-sequence.ts` is the
 * one, separate, already-existing tool for that). Running this against real Production data and
 * deciding what to do about a non-empty result is a maintainer action (AGENTS.md's "Provider
 * configuration workflow" — this repo does not auto-execute changes against Production).
 */
export interface LegacySessionSummary {
  subjectType: "LEAGUE" | "EVENT";
  sessionId: string;
  matchId: string;
  /** Count of events on this session with no persisted sequence. */
  unsequencedEventCount: number;
}

export interface LegacySessionCutoverCheckResult {
  legacySessions: LegacySessionSummary[];
  /** True when every currently-ACTIVE session (League and Event) is fully sequence-assigned —
   * the cutover checklist's "no active legacy session" condition. */
  cutoverSafe: boolean;
}

async function findLegacyLeagueSessionsUnscoped(): Promise<LegacySessionSummary[]> {
  const activeSessions = await db.liveMatchSession.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, matchId: true },
  });

  const results: LegacySessionSummary[] = [];
  for (const session of activeSessions) {
    const unsequencedEventCount = await db.liveMatchEvent.count({
      where: { sessionId: session.id, sequence: null },
    });
    if (unsequencedEventCount > 0) {
      results.push({ subjectType: "LEAGUE", sessionId: session.id, matchId: session.matchId, unsequencedEventCount });
    }
  }
  return results;
}

async function findLegacyEventSessionsUnscoped(): Promise<LegacySessionSummary[]> {
  const activeSessions = await db.eventLiveMatchSession.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, eventMatchId: true },
  });

  const results: LegacySessionSummary[] = [];
  for (const session of activeSessions) {
    const unsequencedEventCount = await db.eventLiveMatchEvent.count({
      where: { sessionId: session.id, sequence: null },
    });
    if (unsequencedEventCount > 0) {
      results.push({ subjectType: "EVENT", sessionId: session.id, matchId: session.eventMatchId, unsequencedEventCount });
    }
  }
  return results;
}

/**
 * Checks every currently-ACTIVE League and Event live session across every organisation for
 * unsequenced (pre-coordinator) history. Read-only. See the module doc comment for the
 * `runWithSystemPrivilege()` justification — identical to `projection-divergence-diagnostic.ts`.
 */
export async function checkActiveLegacySessions(): Promise<LegacySessionCutoverCheckResult> {
  return runWithSystemPrivilege("live-legacy-session-cutover-check", async () => {
    const [league, event] = await Promise.all([findLegacyLeagueSessionsUnscoped(), findLegacyEventSessionsUnscoped()]);
    const legacySessions = [...league, ...event];
    return { legacySessions, cutoverSafe: legacySessions.length === 0 };
  });
}
