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

/**
 * `round_review` context builder (06_AI_CAPABILITY_CONTRACTS.md "1. round_review").
 * Scope is `MatchRound` (`AiAdvisorScopeType.MATCH_ROUND`). Per ADR-0109/ARR-0042, a round is
 * never coach-finalized — it becomes `FINALIZED` automatically at the planning boundary
 * (`ensureMatchPlanningBaselineCaptured()`), which is also this capability's domain trigger.
 *
 * Eligible only once `MatchRound.status === "FINALIZED"` — before that the round's plan is
 * still a live draft that could change under the coach, so `buildContext` returns `null`.
 *
 * Deliberately does not build a separate "structured position coverage" aggregate: each
 * finalized allocation fact already carries the selected player's primary position, which is
 * sufficient signal for the provider without inventing a second derived view — a documented
 * scope adaptation, matching post_match_review's precedent of trimming the "may include" list
 * to a bounded, deterministic subset.
 */

const FACT = "fact";

function ref(prefix: string, index: number): string {
  return `${prefix}${String(index + 1).padStart(2, "0")}`;
}

export async function buildRoundReviewContext(params: {
  organisationId: string;
  scopeId: string;
}): Promise<AiCapabilityContext | null> {
  const matchRound = await db.matchRound.findFirst({
    where: { id: params.scopeId, organisationId: params.organisationId },
    include: { matches: { include: { team: true } } },
  });
  if (!matchRound || matchRound.status !== "FINALIZED") return null;

  const matchIds = matchRound.matches.map((m) => m.id);

  const [selections, availabilities, helperAssignments, warnings] = await Promise.all([
    db.selection.findMany({
      where: { matchRoundId: matchRound.id, organisationId: params.organisationId, status: "FINALIZED" },
      select: { playerId: true, matchId: true, role: true },
    }),
    db.availability.findMany({
      where: { matchRoundId: matchRound.id, organisationId: params.organisationId },
      select: { playerId: true, status: true },
    }),
    db.matchHelperAssignment.findMany({
      where: { matchId: { in: matchIds }, organisationId: params.organisationId },
      select: { playerId: true, matchId: true, sourceTeamId: true },
    }),
    db.warning.findMany({
      where: { matchRoundId: matchRound.id, organisationId: params.organisationId },
      select: { matchId: true, teamId: true, severity: true, rule: true, message: true },
    }),
  ]);

  const playerIds = new Set<string>();
  for (const s of selections) playerIds.add(s.playerId);
  for (const a of availabilities) playerIds.add(a.playerId);
  for (const h of helperAssignments) playerIds.add(h.playerId);

  const players = playerIds.size
    ? await db.player.findMany({ where: { id: { in: [...playerIds] } }, select: { id: true, primaryPosition: true } })
    : [];
  const positionByPlayer = new Map(players.map((p) => [p.id, p.primaryPosition]));

  // Season-to-date opportunity history: total FINALIZED selections per player across every
  // round of this round's league season, including this round's own now-finalized selections.
  const seasonRounds = await db.matchRound.findMany({
    where: { leagueSeasonId: matchRound.leagueSeasonId, organisationId: params.organisationId },
    select: { id: true },
  });
  const seasonSelections = playerIds.size
    ? await db.selection.findMany({
        where: {
          matchRoundId: { in: seasonRounds.map((r) => r.id) },
          organisationId: params.organisationId,
          status: "FINALIZED",
          playerId: { in: [...playerIds] },
        },
        select: { playerId: true },
      })
    : [];
  const seasonAppearanceCounts = new Map<string, number>();
  for (const s of seasonSelections) {
    seasonAppearanceCounts.set(s.playerId, (seasonAppearanceCounts.get(s.playerId) ?? 0) + 1);
  }

  const teamIds = new Set<string>();
  for (const m of matchRound.matches) teamIds.add(m.teamId);
  for (const h of helperAssignments) teamIds.add(h.sourceTeamId);
  const teams = await db.team.findMany({
    where: { id: { in: [...teamIds] } },
    select: { id: true, name: true, targetSquadSize: true, maxSquadSize: true },
  });

  const sortedTeamIds = [...teamIds].sort();
  const sortedMatchIds = [...matchIds].sort();
  const sortedPlayerIds = [...playerIds].sort();

  const teamRefById = new Map(sortedTeamIds.map((id, index) => [id, ref("T", index)]));
  const matchRefById = new Map(sortedMatchIds.map((id, index) => [id, ref("M", index)]));
  const playerRefById = new Map(sortedPlayerIds.map((id, index) => [id, ref("P", index)]));
  const roundRef = "R01";

  const refMap = new Map<string, AiCapabilityRefTarget>();
  refMap.set(roundRef, { subjectType: AiInsightSubjectType.ROUND, entityId: matchRound.id });
  for (const [teamId, teamRef] of teamRefById) refMap.set(teamRef, { subjectType: AiInsightSubjectType.TEAM, entityId: teamId });
  for (const [matchId, matchRef] of matchRefById) refMap.set(matchRef, { subjectType: AiInsightSubjectType.MATCH, entityId: matchId });
  for (const [playerId, playerRef] of playerRefById) refMap.set(playerRef, { subjectType: AiInsightSubjectType.PLAYER, entityId: playerId });

  const evidenceRefs = new Set<string>();

  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const matchByTeam = new Map(matchRound.matches.map((m) => [m.teamId, m]));
  const teamFacts = sortedTeamIds
    .map((teamId) => {
      const teamRef = teamRefById.get(teamId)!;
      const team = teamsById.get(teamId);
      const match = matchByTeam.get(teamId);
      const selectedCount = selections.filter((s) => match && s.matchId === match.id).length;
      return {
        teamRef,
        name: team?.name ?? null,
        targetSquadSize: team?.targetSquadSize ?? null,
        maxSquadSize: team?.maxSquadSize ?? null,
        selectedCount,
      };
    })
    .sort((a, b) => a.teamRef.localeCompare(b.teamRef));
  for (const t of teamFacts) evidenceRefs.add(`${FACT}:squad-size:${t.teamRef}`);

  const matchFacts = sortedMatchIds
    .map((matchId) => {
      const match = matchRound.matches.find((m) => m.id === matchId)!;
      return { matchRef: matchRefById.get(matchId)!, teamRef: teamRefById.get(match.teamId)!, squadSize: match.squadSize };
    })
    .sort((a, b) => a.matchRef.localeCompare(b.matchRef));

  const allocationCounters = new Map<string, number>();
  const allocationFacts = selections
    .map((s) => {
      const playerRef = playerRefById.get(s.playerId);
      const matchRef = matchRefById.get(s.matchId);
      if (!playerRef || !matchRef) return null;
      const n = (allocationCounters.get(playerRef) ?? 0) + 1;
      allocationCounters.set(playerRef, n);
      const evidenceRef = `${FACT}:round-allocation:${playerRef}:${n}`;
      evidenceRefs.add(evidenceRef);
      return { playerRef, matchRef, role: s.role, position: positionByPlayer.get(s.playerId) ?? null, evidenceRef };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null)
    .sort((a, b) => a.evidenceRef.localeCompare(b.evidenceRef));

  const availabilityFacts = availabilities
    .map((a) => ({ playerRef: playerRefById.get(a.playerId), status: a.status }))
    .filter((a): a is { playerRef: string; status: typeof a.status } => a.playerRef !== undefined)
    .sort((a, b) => a.playerRef.localeCompare(b.playerRef));
  for (const a of availabilityFacts) evidenceRefs.add(`${FACT}:availability:${a.playerRef}`);

  const supportCounters = new Map<string, number>();
  const supportMovementFacts = helperAssignments
    .map((h) => ({ playerRef: playerRefById.get(h.playerId), matchRef: matchRefById.get(h.matchId), sourceTeamRef: teamRefById.get(h.sourceTeamId) }))
    .filter((h): h is { playerRef: string; matchRef: string; sourceTeamRef: string } => h.playerRef !== undefined && h.matchRef !== undefined && h.sourceTeamRef !== undefined)
    .map((h) => {
      const n = (supportCounters.get(h.playerRef) ?? 0) + 1;
      supportCounters.set(h.playerRef, n);
      const evidenceRef = `${FACT}:support-movement:${h.playerRef}:${n}`;
      evidenceRefs.add(evidenceRef);
      return { ...h, evidenceRef };
    })
    .sort((a, b) => a.evidenceRef.localeCompare(b.evidenceRef));

  const ruleOutcomeCounters = new Map<string, number>();
  const ruleOutcomeFacts = warnings
    .map((w) => {
      const scopeRef = (w.matchId ? matchRefById.get(w.matchId) : undefined) ?? (w.teamId ? teamRefById.get(w.teamId) : undefined) ?? roundRef;
      return { scopeRef, severity: w.severity, rule: w.rule, message: w.message };
    })
    .map((w) => {
      const n = (ruleOutcomeCounters.get(w.scopeRef) ?? 0) + 1;
      ruleOutcomeCounters.set(w.scopeRef, n);
      const evidenceRef = `${FACT}:rule-outcome:${w.scopeRef}:${n}`;
      evidenceRefs.add(evidenceRef);
      return { ...w, evidenceRef };
    })
    .sort((a, b) => a.evidenceRef.localeCompare(b.evidenceRef));

  const opportunityHistoryFacts = sortedPlayerIds
    .map((playerId) => ({ playerRef: playerRefById.get(playerId)!, seasonAppearances: seasonAppearanceCounts.get(playerId) ?? 0 }))
    .sort((a, b) => a.playerRef.localeCompare(b.playerRef));
  for (const o of opportunityHistoryFacts) evidenceRefs.add(`${FACT}:opportunity:${o.playerRef}`);

  const normalizedContext: JsonValue = {
    round: { ref: roundRef, name: matchRound.name },
    teams: teamFacts,
    matches: matchFacts,
    roundAllocation: allocationFacts,
    availability: availabilityFacts,
    supportMovements: supportMovementFacts,
    ruleOutcomes: ruleOutcomeFacts,
    opportunityHistory: opportunityHistoryFacts,
  };

  const instructions = [
    "Capability: round_review. Review this finalised round's recorded plan facts.",
    "Do not reselect players or propose an alternative squad allocation.",
    "Do not say a deterministic Matchboard rule outcome is wrong, and do not propose changing any support/helper movement.",
    "Do not infer ambition, commitment, attitude, or character from availability or selection patterns.",
    "You may propose at most one development observation per player, only via the confirm_development_observation action, and only when a supplied fact clearly supports it — every proposal requires explicit coach confirmation before it becomes real.",
  ].join(" ");

  return { normalizedContext, instructions, refMap, evidenceRefs };
}

export const roundReviewCapabilityHandler: AiCapabilityHandler = {
  capability: "ROUND_REVIEW",
  buildContext: buildRoundReviewContext,
};

registerAiCapabilityHandler(roundReviewCapabilityHandler);
