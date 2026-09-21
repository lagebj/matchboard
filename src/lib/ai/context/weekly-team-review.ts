import "server-only";
import { db } from "@/lib/db";
import { AiInsightSubjectType } from "@/generated/prisma/client";
import {
  registerAiCapabilityHandler,
  type AiCapabilityContext,
  type AiCapabilityHandler,
  type AiCapabilityRefTarget,
} from "@/lib/ai/jobs/capability-handler";
import type { JsonValue } from "@/lib/ai/fingerprints";
import { getWeekRangeFromIsoWeekKey } from "@/lib/date-utils";
import { computeRoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";

/**
 * `weekly_team_review` context builder (06_AI_CAPABILITY_CONTRACTS.md "5. weekly_team_review").
 * Scope is `Team/week` (`AiAdvisorScopeType.TEAM_WEEK`) — a composite scope with no prior
 * call-site precedent in this repo, so this PR defines the `scopeId` convention:
 * `${teamId}:${weekKey}` (`weekKey` in `formatIsoWeekKey()`'s `YYYY-Www` form, e.g. "2025-W03"),
 * parsed back out at the top of `buildContext` — `enqueueDueWeeklyTeamReviewJobs()`
 * (`jobs/scheduled-triggers.ts`) is the only producer of this id shape.
 *
 * Deliberately does not reuse `src/lib/weekly/get-weekly-coaching-context.ts`: that module is
 * org-wide (every team, League and Event together) and UI-shaped (hrefs, display labels) for a
 * human-facing surface — this capability needs one team's own structured facts only, so it
 * queries Prisma directly, the same choice `round_review`/`lineup_review`/`match_prep` already
 * made over reusing bigger UI-oriented aggregates.
 *
 * League-only, matching this repo's "League and Event: shown together, fairness kept apart"
 * rule (AGENTS.md) — `Team` itself has no Event equivalent (Event squads are not `Team` rows).
 *
 * Scope adaptation: does not build a dedicated "positional exposure" aggregate beyond each
 * player's distinct realised positions this week (from `ActualPositionInterval.position`) —
 * the fuller formation-slot-mapped positional-exposure computation
 * (`src/lib/insights/position-exposure.ts`) is actor-context-bound (built for a request, not a
 * cron/queue worker) and would duplicate that existing insight rather than add new
 * capability-specific signal, the same bounded-subset precedent `lineup_review` already
 * documented for its own "evidence-backed positional exposure" scope-out.
 */

const FACT = "fact";

function ref(prefix: string, index: number): string {
  return `${prefix}${String(index + 1).padStart(2, "0")}`;
}

export function buildWeeklyTeamReviewScopeId(teamId: string, weekKey: string): string {
  return `${teamId}:${weekKey}`;
}

/** Exported so the presentation layer (view-model builder) and the confirm/dismiss actions can
 * recover `teamId` from a `TEAM_WEEK` review's `scopeId` without duplicating this parsing. */
export function parseWeeklyTeamReviewScopeId(scopeId: string): { teamId: string; weekKey: string } | null {
  const separatorIndex = scopeId.indexOf(":");
  if (separatorIndex <= 0 || separatorIndex === scopeId.length - 1) return null;
  return { teamId: scopeId.slice(0, separatorIndex), weekKey: scopeId.slice(separatorIndex + 1) };
}

/** Sums only *closed* intervals (`endedAtMs` set), matching `post-match-review.ts`'s
 * `sumClosedMinutes` — an interval still open at query time has no trustworthy end. */
function sumClosedMinutes(intervals: { startedAtMs: number; endedAtMs: number | null }[]): number {
  const totalMs = intervals.reduce(
    (sum, interval) => (interval.endedAtMs === null ? sum : sum + Math.max(0, interval.endedAtMs - interval.startedAtMs)),
    0,
  );
  return Math.round(totalMs / 60000);
}

export async function buildWeeklyTeamReviewContext(params: {
  organisationId: string;
  scopeId: string;
}): Promise<AiCapabilityContext | null> {
  const parsed = parseWeeklyTeamReviewScopeId(params.scopeId);
  if (!parsed) return null;
  const { teamId, weekKey } = parsed;

  const team = await db.team.findFirst({ where: { id: teamId, organisationId: params.organisationId }, select: { id: true } });
  if (!team) return null;

  let weekRange: { startsAt: Date; endsAt: Date };
  try {
    weekRange = getWeekRangeFromIsoWeekKey(weekKey);
  } catch {
    return null;
  }

  const weekMatches = await db.match.findMany({
    where: { teamId, organisationId: params.organisationId, startsAt: { gte: weekRange.startsAt, lte: weekRange.endsAt }, status: { not: "CANCELLED" } },
    select: { id: true, matchRoundId: true },
  });
  if (weekMatches.length === 0) return null; // "only if relevant activity exists"

  const matchIds = weekMatches.map((m) => m.id);
  const roundIds = [...new Set(weekMatches.map((m) => m.matchRoundId))];

  const [selections, actualIntervals, supportMovements, warnings, integrityByRound] = await Promise.all([
    db.selection.findMany({
      where: { matchId: { in: matchIds }, organisationId: params.organisationId, status: "FINALIZED" },
      select: { playerId: true, matchId: true, role: true },
    }),
    db.actualPositionInterval.findMany({
      where: { matchId: { in: matchIds }, organisationId: params.organisationId, playerId: { not: null } },
      select: { playerId: true, matchId: true, position: true, startedAtMs: true, endedAtMs: true },
    }),
    db.movementLedger.findMany({
      where: { matchId: { in: matchIds }, organisationId: params.organisationId, toTeamId: teamId, role: "SUPPORT" },
      select: { playerId: true, matchId: true, fromTeamId: true },
    }),
    db.warning.findMany({
      where: { organisationId: params.organisationId, matchRoundId: { in: roundIds }, OR: [{ matchId: { in: matchIds } }, { teamId }] },
      select: { matchId: true, teamId: true, severity: true, rule: true },
    }),
    Promise.all(roundIds.map((roundId) => computeRoundPlanIntegrity(roundId))),
  ]);

  // AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY signals don't carry `teamId` (they're derived
  // from `Player.coreTeamId`, not a match-scoped assignment — see
  // `compute-plan-integrity.ts`'s "5. AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY" section), so
  // this team's own gap players are found by cross-checking each candidate player's core team.
  const candidateGapPlayerIds = new Set<string>();
  for (const integrity of integrityByRound) {
    for (const signal of integrity.signals) {
      if (signal.ruleCode === "AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY" && signal.playerId) {
        candidateGapPlayerIds.add(signal.playerId);
      }
    }
  }
  const candidateGapPlayers = candidateGapPlayerIds.size
    ? await db.player.findMany({ where: { id: { in: [...candidateGapPlayerIds] } }, select: { id: true, coreTeamId: true } })
    : [];
  const opportunityGapPlayerIds = new Set(candidateGapPlayers.filter((p) => p.coreTeamId === teamId).map((p) => p.id));

  const activeDevelopmentThreads = selections.length
    ? await db.developmentThread.findMany({
        where: { playerId: { in: selections.map((s) => s.playerId) }, organisationId: params.organisationId, status: "ACTIVE", category: { not: null } },
        select: { playerId: true, category: true },
      })
    : [];

  const playerIds = new Set<string>();
  for (const s of selections) playerIds.add(s.playerId);
  for (const i of actualIntervals) if (i.playerId) playerIds.add(i.playerId);
  for (const m of supportMovements) playerIds.add(m.playerId);
  for (const id of opportunityGapPlayerIds) playerIds.add(id);
  for (const t of activeDevelopmentThreads) playerIds.add(t.playerId);

  const sortedPlayerIds = [...playerIds].sort();
  const playerRefById = new Map(sortedPlayerIds.map((id, index) => [id, ref("P", index)]));
  const matchRefById = new Map(matchIds.slice().sort().map((id, index) => [id, ref("M", index)]));
  const teamRef = "T01";

  const refMap = new Map<string, AiCapabilityRefTarget>();
  refMap.set(teamRef, { subjectType: AiInsightSubjectType.TEAM, entityId: teamId });
  for (const [matchId, matchRef] of matchRefById) {
    refMap.set(matchRef, { subjectType: AiInsightSubjectType.MATCH, entityId: matchId });
  }
  for (const [playerId, playerRef] of playerRefById) {
    refMap.set(playerRef, { subjectType: AiInsightSubjectType.PLAYER, entityId: playerId });
  }

  const evidenceRefs = new Set<string>();

  const opportunityFacts = [...selections]
    .map((s) => ({ playerRef: playerRefById.get(s.playerId)!, matchRef: matchRefById.get(s.matchId)!, role: String(s.role) }))
    .sort((a, b) => a.playerRef.localeCompare(b.playerRef) || a.matchRef.localeCompare(b.matchRef));
  for (const o of opportunityFacts) evidenceRefs.add(`${FACT}:opportunity:${o.playerRef}:${o.matchRef}`);

  const withoutOpportunityFacts = [...opportunityGapPlayerIds]
    .map((playerId) => ({ playerRef: playerRefById.get(playerId)! }))
    .sort((a, b) => a.playerRef.localeCompare(b.playerRef));
  for (const w of withoutOpportunityFacts) evidenceRefs.add(`${FACT}:without-opportunity:${w.playerRef}`);

  const minutesByPlayer = new Map<string, { startedAtMs: number; endedAtMs: number | null }[]>();
  const positionsByPlayer = new Map<string, Set<string>>();
  for (const interval of actualIntervals) {
    if (!interval.playerId) continue;
    const list = minutesByPlayer.get(interval.playerId) ?? [];
    list.push({ startedAtMs: interval.startedAtMs, endedAtMs: interval.endedAtMs });
    minutesByPlayer.set(interval.playerId, list);
    const positions = positionsByPlayer.get(interval.playerId) ?? new Set<string>();
    positions.add(interval.position);
    positionsByPlayer.set(interval.playerId, positions);
  }
  const minutesFacts = [...minutesByPlayer.keys()]
    .map((playerId) => ({ playerRef: playerRefById.get(playerId)!, minutes: sumClosedMinutes(minutesByPlayer.get(playerId)!) }))
    .sort((a, b) => a.playerRef.localeCompare(b.playerRef));
  for (const m of minutesFacts) evidenceRefs.add(`${FACT}:minutes:${m.playerRef}`);

  const positionalExposureFacts = [...positionsByPlayer.keys()]
    .map((playerId) => ({ playerRef: playerRefById.get(playerId)!, positions: [...positionsByPlayer.get(playerId)!].sort() }))
    .sort((a, b) => a.playerRef.localeCompare(b.playerRef));
  for (const p of positionalExposureFacts) evidenceRefs.add(`${FACT}:positional-exposure:${p.playerRef}`);

  const supportMovementFacts = supportMovements
    .map((m) => ({ playerRef: playerRefById.get(m.playerId)!, matchRef: matchRefById.get(m.matchId)!, fromTeamId: m.fromTeamId }))
    .sort((a, b) => a.playerRef.localeCompare(b.playerRef) || a.matchRef.localeCompare(b.matchRef));
  for (const s of supportMovementFacts) evidenceRefs.add(`${FACT}:support-movement:${s.playerRef}:${s.matchRef}`);

  const ruleOutcomeCounters = new Map<string, number>();
  const ruleOutcomeFacts = warnings
    .map((w) => (w.matchId ? matchRefById.get(w.matchId) : undefined) ?? teamRef)
    .map((scopeRef, index) => ({ scopeRef, severity: warnings[index].severity, rule: warnings[index].rule }))
    .map((w) => {
      const n = (ruleOutcomeCounters.get(w.scopeRef) ?? 0) + 1;
      ruleOutcomeCounters.set(w.scopeRef, n);
      const evidenceRef = `${FACT}:rule-outcome:${w.scopeRef}:${n}`;
      evidenceRefs.add(evidenceRef);
      return { ...w, evidenceRef };
    })
    .sort((a, b) => a.evidenceRef.localeCompare(b.evidenceRef));

  const developmentFocusFacts = activeDevelopmentThreads
    .map((t) => ({ playerRef: playerRefById.get(t.playerId)!, category: t.category }))
    .sort((a, b) => a.playerRef.localeCompare(b.playerRef));
  for (const d of developmentFocusFacts) evidenceRefs.add(`${FACT}:development-focus:${d.playerRef}`);

  const normalizedContext: JsonValue = {
    team: { ref: teamRef, weekKey },
    matches: [...matchRefById.entries()].map(([, matchRef]) => ({ ref: matchRef })).sort((a, b) => a.ref.localeCompare(b.ref)),
    opportunities: opportunityFacts,
    playersWithoutOpportunity: withoutOpportunityFacts,
    minutesRecorded: minutesFacts,
    positionalExposure: positionalExposureFacts,
    supportMovements: supportMovementFacts,
    ruleOutcomes: ruleOutcomeFacts,
    developmentFocus: developmentFocusFacts,
  };

  const instructions = [
    "Capability: weekly_team_review. Review this team's previous completed week using only the supplied structured facts.",
    "Do not infer ambition, attitude, commitment, character, or family availability reasons for any player.",
    "Do not label any player as strong, weak, better, or worse than another.",
    "You may propose at most one development observation per player, only via the confirm_development_observation action, and only when a supplied fact clearly supports it — every proposal requires explicit coach confirmation before it becomes real.",
  ].join(" ");

  return { normalizedContext, instructions, refMap, evidenceRefs };
}

export const weeklyTeamReviewCapabilityHandler: AiCapabilityHandler = {
  capability: "WEEKLY_TEAM_REVIEW",
  buildContext: buildWeeklyTeamReviewContext,
};

registerAiCapabilityHandler(weeklyTeamReviewCapabilityHandler);
