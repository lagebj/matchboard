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
 * `lineup_review` context builder (06_AI_CAPABILITY_CONTRACTS.md "2. lineup_review"). Scope is
 * `Match` (`AiAdvisorScopeType.MATCH`).
 *
 * Triggered on every plan edit (`jobs/triggers.ts` callers pass `debounceMs:
 * LINEUP_REVIEW_DEBOUNCE_MS`, collapsing rapid edits into one delayed job — see
 * `jobs/enqueue.ts`'s `enqueueDebouncedAiJob`), but only actually *eligible* once the starting
 * line-up looks complete: `buildContext` returns `null` (not yet eligible) until the match has
 * at least `match.squadSize` CORE-role selections. This means an incomplete draft never gets
 * queued at all — the debounce only ever delays a job for a plan that already looked complete
 * at least once, matching the contract's trigger wording ("a complete ... plan is saved") rather
 * than firing on every keystroke of an obviously-unfinished plan.
 *
 * Deliberately narrows the "may include" list: "coach-declared positions" and "evidence-backed
 * positional exposure" are not built as separate facts here — the League `Selection` model has
 * no coach-declared-position field distinct from the player's own `primaryPosition` (unlike the
 * Event side's `EventSquadPlayer.assignedPositionId`), and a dedicated positional-exposure
 * aggregate would duplicate the existing `position-exposure` insight rather than add new
 * capability-specific signal — the same bounded-subset scope adaptation `post_match_review` and
 * `round_review` already documented.
 */

/** 06_AI_CAPABILITY_CONTRACTS.md "2. lineup_review": "debounce 2 minutes after the last relevant
 * plan change." */
export const LINEUP_REVIEW_DEBOUNCE_MS = 2 * 60 * 1000;

const FACT = "fact";

function ref(prefix: string, index: number): string {
  return `${prefix}${String(index + 1).padStart(2, "0")}`;
}

export async function buildLineupReviewContext(params: {
  organisationId: string;
  scopeId: string;
}): Promise<AiCapabilityContext | null> {
  const match = await db.match.findFirst({
    where: { id: params.scopeId, organisationId: params.organisationId },
    select: { id: true, teamId: true, squadSize: true, formation: true, gameFormat: true, matchDurationMinutes: true, matchRound: { select: { leagueSeasonId: true } } },
  });
  if (!match || !match.matchRound) return null;

  const selections = await db.selection.findMany({
    where: { matchId: match.id, organisationId: params.organisationId, status: { in: ["DRAFT", "FINALIZED"] } },
    select: { playerId: true, role: true },
  });

  const coreCount = selections.filter((s) => s.role === "CORE").length;
  if (coreCount < match.squadSize) return null; // starting line-up not yet complete — not eligible

  const rotations = await db.plannedRotation.findFirst({
    where: { matchId: match.id, teamId: match.teamId, organisationId: params.organisationId },
    select: { changes: { select: { sequence: true, outPlayerId: true, inPlayerId: true, outPosition: true, inPosition: true, approximateMatchSeconds: true } } },
  });
  const rotationChanges = rotations?.changes ?? [];

  const players = selections.length
    ? await db.player.findMany({ where: { id: { in: selections.map((s) => s.playerId) } }, select: { id: true, primaryPosition: true } })
    : [];
  const positionByPlayer = new Map(players.map((p) => [p.id, p.primaryPosition]));

  const playerIds = new Set<string>();
  for (const s of selections) playerIds.add(s.playerId);
  for (const c of rotationChanges) {
    if (c.outPlayerId) playerIds.add(c.outPlayerId);
    if (c.inPlayerId) playerIds.add(c.inPlayerId);
  }

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

  const matchFormatFact = { matchRef, gameFormat: match.gameFormat, matchDurationMinutes: match.matchDurationMinutes };
  evidenceRefs.add(`${FACT}:match-format:${matchRef}`);

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
  const opportunityHistoryFacts = sortedPlayerIds
    .map((playerId) => ({ playerRef: playerRefById.get(playerId)!, seasonAppearances: seasonAppearanceCounts.get(playerId) ?? 0 }))
    .sort((a, b) => a.playerRef.localeCompare(b.playerRef));
  for (const o of opportunityHistoryFacts) evidenceRefs.add(`${FACT}:opportunity:${o.playerRef}`);

  const normalizedContext: JsonValue = {
    match: { ref: matchRef, format: matchFormatFact },
    squad: squadFacts,
    formation: formationFact,
    plannedRotations: rotationFacts,
    opportunityHistory: opportunityHistoryFacts,
  };

  const instructions = [
    "Capability: lineup_review. Review this match's saved starting line-up and rotation plan.",
    "Do not alter the line-up or rotations, and do not invent missing minutes.",
    "Do not label any player as strong, weak, better, or worse than another.",
    "You may propose at most one development observation per player, only via the confirm_development_observation action, and only when a supplied fact clearly supports it — every proposal requires explicit coach confirmation before it becomes real.",
  ].join(" ");

  return { normalizedContext, instructions, refMap, evidenceRefs };
}

export const lineupReviewCapabilityHandler: AiCapabilityHandler = {
  capability: "LINEUP_REVIEW",
  buildContext: buildLineupReviewContext,
};

registerAiCapabilityHandler(lineupReviewCapabilityHandler);
