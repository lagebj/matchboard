// Deliberately no `import "server-only"` here (unlike most `src/lib/live-match/*` modules) —
// this diagnostic is designed to run both from Next.js server code and from a plain-Node CLI
// script (`scripts/live-diagnostics.ts`), and `server-only`'s own guard throws
// outside a Next.js server render, matching the precedent already set by
// `src/lib/data-integrity/audit-data-integrity.ts` for the same reason.
import { db } from "@/lib/db";
import { reduceLiveEvents, type ReducibleLiveEvent } from "./live-match-projection";
import { runWithSystemPrivilege } from "@/lib/tenancy/tenant-async-storage";

/**
 * ADR-0138 Bundle 9 (OBSERVABILITY_RECOVERY_ROLLOUT.md §4) — "projection divergence
 * diagnostic": replays a match's canonical live-event stream through the one shared reducer
 * (`reduceLiveEvents()`, Bundle 5) and compares the result against the corresponding
 * materialized post-match report score, when one exists. This is read-only diagnostics — it
 * never writes to Neon and never mutates a report, matching §4's own "do not auto-mutate
 * Production from this diagnostic" rule.
 *
 * Deliberately scoped to the score comparison only (not on-field-set/positions) — the
 * materialized "who actually played" fact (`PostMatchPlayerActual`) is populated by a
 * different process (attendance/participation entry) with no guaranteed 1:1 correspondence to
 * "who the live event stream shows on the field at full time" (e.g. a player added to the
 * report as PRESENT without ever being explicitly rotated in during live reporting). Score is
 * the one fact both sources are meant to represent identically. A future pass may extend this
 * comparison; this is a disclosed scope decision, not an oversight.
 *
 * Output carries only ids/counts — never player names — per this diagnostic's own §4 rule and
 * this repository's general "coach-facing PII stays out of logs/diagnostics" discipline.
 */

export interface ProjectionDivergenceResult {
  subjectType: "LEAGUE" | "EVENT";
  subjectId: string;
  sessionId: string | null;
  /** Number of canonical events replayed, in persisted-sequence order. */
  canonicalEventCount: number;
  lastSequence: number | null;
  replayed: { goalsFor: number; goalsAgainst: number; onFieldCount: number };
  /** Null when no report exists yet, or the report is still DRAFT (not yet a materialized
   * fact worth comparing against — see AGENTS.md "Canonical data truth"). */
  materialized: { goalsFor: number; goalsAgainst: number; reportStatus: string } | null;
  /** True only when both a canonical replay and a materialized report exist and disagree. */
  diverged: boolean;
  /** Human-readable, name-free notes explaining `diverged`/context. */
  notes: string[];
  /** Replay anomalies surfaced by `reduceLiveEvents()` itself (e.g. an unresolvable reversal
   * target) — distinct from `diverged`, which compares against the materialized report. */
  replayDiagnostics: string[];
}

/**
 * Diagnoses one League match's live-event stream. Read-only.
 *
 * No user/org actor exists on this path — the caller is a trusted maintainer/CLI/internal
 * diagnostic, not a request scoped to a known organisation, and a diagnostic keyed on a single
 * matchId across all organisations has nothing narrower to scope by up front. Wrapped in
 * `runWithSystemPrivilege()` (ADR-0087) with a specific reason, matching the exact precedent
 * already established for the internal snapshot-reconciliation endpoint
 * (`/api/internal/live-match/snapshot/route.ts`) for the same class of problem.
 */
export async function checkLeagueProjectionDivergence(matchId: string): Promise<ProjectionDivergenceResult> {
  return runWithSystemPrivilege("live-projection-divergence-diagnostic", () => checkLeagueProjectionDivergenceUnscoped(matchId));
}

async function checkLeagueProjectionDivergenceUnscoped(matchId: string): Promise<ProjectionDivergenceResult> {
  const session = await db.liveMatchSession.findUnique({
    where: { matchId },
    select: { id: true },
  });

  const events = session
    ? await db.liveMatchEvent.findMany({
        where: { matchId, sessionId: session.id },
        orderBy: [{ sequence: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        select: { id: true, eventType: true, playerId: true, correctsEventId: true, sequence: true },
      })
    : [];

  const lineup = await db.matchLineup.findFirst({ where: { matchId }, select: { id: true } });
  const starterRows = lineup
    ? await db.matchLineupAssignment.findMany({
        where: { matchLineupId: lineup.id, playerId: { not: null } },
        select: { playerId: true },
      })
    : [];
  const startingOnFieldIds = starterRows.map((r) => r.playerId!).filter(Boolean);

  const reducible: ReducibleLiveEvent[] = events.map((e) => ({
    id: e.id,
    eventType: e.eventType,
    playerId: e.playerId ?? undefined,
    correctsEventId: e.correctsEventId ?? undefined,
  }));
  const replay = reduceLiveEvents(reducible, startingOnFieldIds);

  const match = await db.match.findUnique({ where: { id: matchId }, select: { homeAway: true } });
  const report = await db.postMatchReport.findUnique({
    where: { matchId },
    select: { status: true, homeGoals: true, awayGoals: true },
  });

  let materialized: ProjectionDivergenceResult["materialized"] = null;
  const notes: string[] = [];
  if (report && (report.status === "REPORTED" || report.status === "LOCKED") && report.homeGoals != null && report.awayGoals != null) {
    const isHome = match?.homeAway === "HOME";
    const goalsFor = isHome ? report.homeGoals : report.awayGoals;
    const goalsAgainst = isHome ? report.awayGoals : report.homeGoals;
    materialized = { goalsFor, goalsAgainst, reportStatus: report.status };
  } else if (report) {
    notes.push(`Report exists but is not yet materialized (status=${report.status}) — skipped comparison.`);
  } else {
    notes.push("No post-match report exists yet — nothing to compare against.");
  }

  const diverged =
    materialized != null && (materialized.goalsFor !== replay.goalsFor || materialized.goalsAgainst !== replay.goalsAgainst);
  if (diverged) {
    notes.push(
      `Score divergence: replay=${replay.goalsFor}-${replay.goalsAgainst}, report=${materialized!.goalsFor}-${materialized!.goalsAgainst}.`,
    );
  }

  return {
    subjectType: "LEAGUE",
    subjectId: matchId,
    sessionId: session?.id ?? null,
    canonicalEventCount: events.length,
    lastSequence: events.length > 0 ? (events[events.length - 1].sequence ?? null) : null,
    replayed: { goalsFor: replay.goalsFor, goalsAgainst: replay.goalsAgainst, onFieldCount: replay.onFieldPlayerIds.length },
    materialized,
    diverged,
    notes,
    replayDiagnostics: replay.diagnostics,
  };
}

/**
 * Diagnoses one Event match's live-event stream. Read-only. Mirrors
 * `checkLeagueProjectionDivergence()` against Event's own tables — kept as a separate,
 * explicit function rather than a shared generic, matching this codebase's established
 * League/Event adapter convention (D19: separate tables/adapters, one shared behavioral
 * contract). Same `runWithSystemPrivilege()` justification as the League function above.
 */
export async function checkEventProjectionDivergence(eventMatchId: string): Promise<ProjectionDivergenceResult> {
  return runWithSystemPrivilege("live-projection-divergence-diagnostic", () => checkEventProjectionDivergenceUnscoped(eventMatchId));
}

async function checkEventProjectionDivergenceUnscoped(eventMatchId: string): Promise<ProjectionDivergenceResult> {
  const session = await db.eventLiveMatchSession.findUnique({
    where: { eventMatchId },
    select: { id: true },
  });

  const events = session
    ? await db.eventLiveMatchEvent.findMany({
        where: { eventMatchId, sessionId: session.id },
        orderBy: [{ sequence: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        select: { id: true, eventType: true, playerId: true, correctsEventId: true, sequence: true },
      })
    : [];

  const lineup = await db.eventMatchLineup.findFirst({ where: { eventMatchId }, select: { id: true } });
  const starterRows = lineup
    ? await db.eventMatchLineupAssignment.findMany({
        where: { lineupId: lineup.id, playerId: { not: null } },
        select: { playerId: true },
      })
    : [];
  const startingOnFieldIds = starterRows.map((r) => r.playerId!).filter(Boolean);

  const reducible: ReducibleLiveEvent[] = events.map((e) => ({
    id: e.id,
    eventType: e.eventType,
    playerId: e.playerId ?? undefined,
    correctsEventId: e.correctsEventId ?? undefined,
  }));
  const replay = reduceLiveEvents(reducible, startingOnFieldIds);

  const report = await db.eventPostMatchReport.findUnique({
    where: { eventMatchId },
    select: { status: true, ourScore: true, opponentScore: true },
  });

  let materialized: ProjectionDivergenceResult["materialized"] = null;
  const notes: string[] = [];
  if (report && (report.status === "REPORTED" || report.status === "LOCKED") && report.ourScore != null && report.opponentScore != null) {
    materialized = { goalsFor: report.ourScore, goalsAgainst: report.opponentScore, reportStatus: report.status };
  } else if (report) {
    notes.push(`Report exists but is not yet materialized (status=${report.status}) — skipped comparison.`);
  } else {
    notes.push("No post-match report exists yet — nothing to compare against.");
  }

  const diverged =
    materialized != null && (materialized.goalsFor !== replay.goalsFor || materialized.goalsAgainst !== replay.goalsAgainst);
  if (diverged) {
    notes.push(
      `Score divergence: replay=${replay.goalsFor}-${replay.goalsAgainst}, report=${materialized!.goalsFor}-${materialized!.goalsAgainst}.`,
    );
  }

  return {
    subjectType: "EVENT",
    subjectId: eventMatchId,
    sessionId: session?.id ?? null,
    canonicalEventCount: events.length,
    lastSequence: events.length > 0 ? (events[events.length - 1].sequence ?? null) : null,
    replayed: { goalsFor: replay.goalsFor, goalsAgainst: replay.goalsAgainst, onFieldCount: replay.onFieldPlayerIds.length },
    materialized,
    diverged,
    notes,
    replayDiagnostics: replay.diagnostics,
  };
}
