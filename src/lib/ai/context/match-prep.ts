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
 * `match_prep` context builder (06_AI_CAPABILITY_CONTRACTS.md "3. match_prep"). Scope is `Match`
 * (`AiAdvisorScopeType.MATCH`).
 *
 * Unlike `round_review`/`lineup_review`, this capability has no domain-mutation trigger — it is
 * purely cron-scheduled (07_EXECUTION_PIPELINE.md "Domain triggers": "Match preparation ... [is]
 * cron-scheduled"). The cron-side "fixture is 24h-to-kickoff" time-window scan lives in
 * `jobs/scheduled-triggers.ts`, not here: `buildContext` only decides domain eligibility (a
 * complete plan exists for a match that hasn't been cancelled), the same separation of concerns
 * `round_review`/`lineup_review` already use between "when does a caller ask" and "is this scope
 * actually reviewable right now".
 *
 * "Confirmed opponent sporting evidence" and "previous structured encounter evidence" both come
 * from *prior* matches against the same `OpponentTeam` (this match's own `OpponentSportingEvidence`/
 * `OpponentEncounterObservation` rows do not exist yet pre-match) — `OpponentSportingEvidence`'s
 * computed `estimate`/score fields and `OpponentEncounterObservation`'s structured categorical
 * fields (`sportingLevel`, `playingStyleTags`, `concernCategories`, `overallEnvironment`) only;
 * their free-text fields (`sportingLevelNote`, `factualSummary`) are deliberately excluded per
 * 06_AI_CAPABILITY_CONTRACTS.md's "Do not send arbitrary free-text notes in v1." Likewise
 * "structured development focus categories" uses only `DevelopmentThread.category` (an enum),
 * never its free-text `focus`/`rationale` fields. No internet lookup and no inference from the
 * opponent name string are performed — only Matchboard's own previously-recorded structured
 * opponent data is used.
 */

const FACT = "fact";
const MAX_PRIOR_OPPONENT_RECORDS = 3;

function ref(prefix: string, index: number): string {
  return `${prefix}${String(index + 1).padStart(2, "0")}`;
}

export async function buildMatchPrepContext(params: {
  organisationId: string;
  scopeId: string;
}): Promise<AiCapabilityContext | null> {
  const match = await db.match.findFirst({
    where: { id: params.scopeId, organisationId: params.organisationId },
    select: {
      id: true,
      teamId: true,
      squadSize: true,
      formation: true,
      gameFormat: true,
      matchDurationMinutes: true,
      status: true,
      opponentTeamId: true,
      matchRound: { select: { leagueSeasonId: true } },
    },
  });
  if (!match || !match.matchRound) return null;
  if (match.status === "CANCELLED") return null;

  const selections = await db.selection.findMany({
    where: { matchId: match.id, organisationId: params.organisationId, status: { in: ["DRAFT", "FINALIZED"] } },
    select: { playerId: true, role: true },
  });

  const coreCount = selections.filter((s) => s.role === "CORE").length;
  if (coreCount < match.squadSize) return null; // no complete plan yet — not eligible

  const rotations = await db.plannedRotation.findFirst({
    where: { matchId: match.id, teamId: match.teamId, organisationId: params.organisationId },
    select: { changes: { select: { sequence: true, outPlayerId: true, inPlayerId: true, outPosition: true, inPosition: true, approximateMatchSeconds: true } } },
  });
  const rotationChanges = rotations?.changes ?? [];

  const players = selections.length
    ? await db.player.findMany({ where: { id: { in: selections.map((s) => s.playerId) } }, select: { id: true, primaryPosition: true } })
    : [];
  const positionByPlayer = new Map(players.map((p) => [p.id, p.primaryPosition]));

  const activeDevelopmentThreads = selections.length
    ? await db.developmentThread.findMany({
        where: { playerId: { in: selections.map((s) => s.playerId) }, organisationId: params.organisationId, status: "ACTIVE", category: { not: null } },
        select: { playerId: true, category: true },
      })
    : [];

  const playerIds = new Set<string>();
  for (const s of selections) playerIds.add(s.playerId);
  for (const c of rotationChanges) {
    if (c.outPlayerId) playerIds.add(c.outPlayerId);
    if (c.inPlayerId) playerIds.add(c.inPlayerId);
  }
  for (const t of activeDevelopmentThreads) playerIds.add(t.playerId);

  const sortedPlayerIds = [...playerIds].sort();
  const playerRefById = new Map(sortedPlayerIds.map((id, index) => [id, ref("P", index)]));
  const matchRef = "M01";

  const refMap = new Map<string, AiCapabilityRefTarget>();
  refMap.set(matchRef, { subjectType: AiInsightSubjectType.MATCH, entityId: match.id });
  for (const [playerId, playerRef] of playerRefById) {
    refMap.set(playerRef, { subjectType: AiInsightSubjectType.PLAYER, entityId: playerId });
  }

  const evidenceRefs = new Set<string>();

  const squadFacts = [...selections]
    .map((s) => ({ playerRef: playerRefById.get(s.playerId)!, role: String(s.role), position: positionByPlayer.get(s.playerId) ?? null }))
    .sort((a, b) => a.playerRef.localeCompare(b.playerRef));
  for (const s of squadFacts) evidenceRefs.add(`${FACT}:squad:${s.playerRef}`);

  const formationFact = match.formation ? { matchRef, formation: match.formation } : null;
  if (formationFact) evidenceRefs.add(`${FACT}:formation:${matchRef}`);

  const rotationFacts = rotationChanges
    .map((c) => ({
      sequence: c.sequence,
      outPlayerRef: c.outPlayerId ? playerRefById.get(c.outPlayerId) ?? null : null,
      inPlayerRef: c.inPlayerId ? playerRefById.get(c.inPlayerId) ?? null : null,
      outPosition: c.outPosition,
      inPosition: c.inPosition,
      approximateMatchSeconds: c.approximateMatchSeconds,
    }))
    .sort((a, b) => a.sequence - b.sequence);
  for (const r of rotationFacts) evidenceRefs.add(`${FACT}:planned-rotation:${matchRef}:${r.sequence}`);

  evidenceRefs.add(`${FACT}:match-format:${matchRef}`);
  const matchFormatFact = { matchRef, gameFormat: match.gameFormat, matchDurationMinutes: match.matchDurationMinutes };

  const developmentFocusFacts = activeDevelopmentThreads
    .map((t) => ({ playerRef: playerRefById.get(t.playerId)!, category: t.category }))
    .sort((a, b) => a.playerRef.localeCompare(b.playerRef));
  for (const d of developmentFocusFacts) evidenceRefs.add(`${FACT}:development-focus:${d.playerRef}`);

  const seasonRounds = await db.matchRound.findMany({
    where: { leagueSeasonId: match.matchRound.leagueSeasonId, organisationId: params.organisationId },
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
  const recentParticipationFacts = sortedPlayerIds
    .map((playerId) => ({ playerRef: playerRefById.get(playerId)!, seasonAppearances: seasonAppearanceCounts.get(playerId) ?? 0 }))
    .sort((a, b) => a.playerRef.localeCompare(b.playerRef));
  for (const p of recentParticipationFacts) evidenceRefs.add(`${FACT}:participation:${p.playerRef}`);

  let opponentSportingFacts: { occurredAt: string; goalsFor: number; goalsAgainst: number; estimate: string }[] = [];
  let opponentEncounterFacts: {
    overallEnvironment: string;
    sportingLevel: string | null;
    playingStyleTags: string[];
    concernCategories: string[];
  }[] = [];

  if (match.opponentTeamId) {
    const priorSportingEvidence = await db.opponentSportingEvidence.findMany({
      where: { opponentTeamId: match.opponentTeamId, organisationId: params.organisationId, matchId: { not: match.id }, excludedAt: null },
      select: { occurredAt: true, goalsFor: true, goalsAgainst: true, estimate: true },
      orderBy: { occurredAt: "desc" },
      take: MAX_PRIOR_OPPONENT_RECORDS,
    });
    opponentSportingFacts = priorSportingEvidence
      .map((e) => ({ occurredAt: e.occurredAt.toISOString(), goalsFor: e.goalsFor, goalsAgainst: e.goalsAgainst, estimate: e.estimate.toString() }))
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    if (opponentSportingFacts.length > 0) evidenceRefs.add(`${FACT}:opponent-sporting:${matchRef}`);

    const priorEncounterObservations = await db.opponentEncounterObservation.findMany({
      where: { opponentTeamId: match.opponentTeamId, organisationId: params.organisationId, matchId: { not: match.id } },
      select: { overallEnvironment: true, sportingLevel: true, playingStyleTags: true, concernCategories: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: MAX_PRIOR_OPPONENT_RECORDS,
    });
    opponentEncounterFacts = priorEncounterObservations
      .map((e) => ({
        overallEnvironment: String(e.overallEnvironment),
        sportingLevel: e.sportingLevel ? e.sportingLevel.toString() : null,
        playingStyleTags: [...e.playingStyleTags].map(String).sort(),
        concernCategories: [...e.concernCategories].map(String).sort(),
      }))
      .sort((a, b) => a.overallEnvironment.localeCompare(b.overallEnvironment) || a.playingStyleTags.join(",").localeCompare(b.playingStyleTags.join(",")));
    if (opponentEncounterFacts.length > 0) evidenceRefs.add(`${FACT}:opponent-encounter:${matchRef}`);
  }

  const normalizedContext: JsonValue = {
    match: { ref: matchRef, format: matchFormatFact },
    squad: squadFacts,
    formation: formationFact,
    plannedRotations: rotationFacts,
    developmentFocus: developmentFocusFacts,
    recentParticipation: recentParticipationFacts,
    opponentSportingEvidence: opponentSportingFacts,
    opponentEncounterEvidence: opponentEncounterFacts,
  };

  const instructions = [
    "Capability: match_prep. Prepare the coach for this upcoming match using only the supplied structured facts.",
    "Do not perform any internet lookup and do not infer anything from the opponent's name.",
    "Do not alter the line-up or rotations, and do not invent missing minutes.",
    "Do not label any player as strong, weak, better, or worse than another.",
    "Target 3 to 5 useful observations.",
    "You may propose at most one development observation per player, only via the confirm_development_observation action, and only when a supplied fact clearly supports it — every proposal requires explicit coach confirmation before it becomes real.",
  ].join(" ");

  return { normalizedContext, instructions, refMap, evidenceRefs };
}

export const matchPrepCapabilityHandler: AiCapabilityHandler = {
  capability: "MATCH_PREP",
  buildContext: buildMatchPrepContext,
};

registerAiCapabilityHandler(matchPrepCapabilityHandler);
