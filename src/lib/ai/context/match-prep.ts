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
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { buildMatchInsightFacts } from "@/lib/matches/match-insights/build-match-insight-facts";
import type { CurrentPlanInput, MatchInsightFact } from "@/lib/matches/match-insights/types";

/**
 * `match_prep` context builder (06_AI_CAPABILITY_CONTRACTS.md "3. match_prep"; ADR-0149).
 * Scope is `Match` (`AiAdvisorScopeType.MATCH`).
 *
 * Rebuilt on `src/lib/matches/match-insights/build-match-insight-facts.ts` (ADR-0149 Decision 4):
 * this is the same fact source a future Match Insights view-model reads, so the deterministic
 * facts a coach sees and the facts the AI is grounded in are computed once, not derived twice.
 *
 * `buildMatchInsightFacts()`'s own output (`playerSummaries`/`opponentContext`/`teamHistory`) uses
 * real `playerId`/`matchId` values throughout -- correct for that module's other consumer (a
 * future server-rendered UI, which already has DB access and never sends this data externally).
 * Everything below this point launders that into the AI-safe shape ADR-0148 Decision 5 requires:
 * ephemeral refs (`P01`, `M01`) for every entity, and no other real database id anywhere in
 * `normalizedContext`/`evidenceRefs` -- including a previous encounter's own match id, which is
 * never itself needed by the AI (only its date/result/formation/observations are) and is instead
 * distinguished, when more than one exists, by a plain 1-based index in the evidence ref.
 *
 * "Confirmed opponent sporting evidence" and "previous structured encounter evidence" both come
 * from *prior* matches against the same `OpponentTeam` (this match's own `OpponentSportingEvidence`/
 * `OpponentEncounterObservation` rows do not exist yet pre-match). ADR-0149 Decision 3's narrow,
 * disclosed exception is what allows `opponentContext.previousEncounters[].trustedObservation`
 * into this context at all: bounded, truncated, and always carried with its attribution label --
 * never presented as an objective fact. Every other free-text field
 * (`sportingLevelNote`, `Match.notes`, etc.) remains excluded, matching every other capability's
 * existing "no arbitrary free-text notes" doctrine.
 */

function ref(prefix: string, index: number): string {
  return `${prefix}${String(index + 1).padStart(2, "0")}`;
}

/** `Selection.role` (`SelectionRole`) has six values; the Match Insight domain layer only
 * distinguishes CORE/SUPPORT/DEVELOPMENT (bundle's "role" concept for adjacency/opportunity
 * facts). `BACKFILL`/`CONFIDENCE_REBUILD`/`CORE_MATCH_DROP` are non-primary-starting,
 * non-development roles -- the closest existing bucket is SUPPORT. */
function toPlanRole(role: string): "CORE" | "SUPPORT" | "DEVELOPMENT" {
  if (role === "CORE") return "CORE";
  if (role === "DEVELOPMENT") return "DEVELOPMENT";
  return "SUPPORT";
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
      startsAt: true,
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
  if (coreCount < match.squadSize) return null; // no complete plan yet -- not eligible

  const players = selections.length
    ? await db.player.findMany({ where: { id: { in: selections.map((s) => s.playerId) } }, select: { id: true, primaryPosition: true } })
    : [];
  const positionByPlayer = new Map(players.map((p) => [p.id, p.primaryPosition]));

  const rotation = await db.plannedRotation.findFirst({
    where: { matchId: match.id, teamId: match.teamId, organisationId: params.organisationId },
    select: { changes: { select: { sequence: true, outPlayerId: true, inPlayerId: true, outPosition: true, inPosition: true } } },
  });
  const rotationChanges = [...(rotation?.changes ?? [])].sort((a, b) => a.sequence - b.sequence);

  const plan: CurrentPlanInput = {
    matchId: match.id,
    teamId: match.teamId,
    organisationId: params.organisationId,
    leagueSeasonId: match.matchRound.leagueSeasonId,
    opponentTeamId: match.opponentTeamId,
    formation: match.formation,
    matchStartsAt: match.startsAt,
    squad: selections.map((s) => ({ playerId: s.playerId, role: toPlanRole(s.role), position: positionByPlayer.get(s.playerId) ?? null })),
    plannedRotations: rotationChanges.map((c) => ({
      sequence: c.sequence,
      outPlayerId: c.outPlayerId,
      inPlayerId: c.inPlayerId,
      outPosition: c.outPosition,
      inPosition: c.inPosition,
    })),
  };

  const orgFilter: OrgFilterMode = {
    type: "org",
    filter: { organisationId: params.organisationId },
    filterNullable: { organisationId: params.organisationId },
    organisationId: params.organisationId,
  };

  const bundle = await buildMatchInsightFacts(plan, orgFilter);

  const sortedPlayerIds = [...bundle.playerSummaries.keys()].sort();
  const playerRefById = new Map(sortedPlayerIds.map((id, index) => [id, ref("P", index)]));
  const matchRef = "M01";

  const refMap = new Map<string, AiCapabilityRefTarget>();
  refMap.set(matchRef, { subjectType: AiInsightSubjectType.MATCH, entityId: match.id });
  for (const [playerId, playerRef] of playerRefById) {
    refMap.set(playerRef, { subjectType: AiInsightSubjectType.PLAYER, entityId: playerId });
  }

  const evidenceRefs = new Set<string>();
  const FACT = "fact";

  // ---- squad / formation / rotations (the current plan itself) ----

  const squadFacts = [...plan.squad]
    .map((s) => ({ playerRef: playerRefById.get(s.playerId)!, role: s.role, position: s.position }))
    .sort((a, b) => a.playerRef.localeCompare(b.playerRef));
  for (const s of squadFacts) evidenceRefs.add(`${FACT}:squad:${s.playerRef}`);

  const formationFact = match.formation ? { matchRef, formation: match.formation } : null;
  if (formationFact) evidenceRefs.add(`${FACT}:formation:${matchRef}`);

  evidenceRefs.add(`${FACT}:match-format:${matchRef}`);
  const matchFormatFact = { matchRef, gameFormat: match.gameFormat, matchDurationMinutes: match.matchDurationMinutes };

  const rotationFacts = plan.plannedRotations
    .map((r) => ({
      sequence: r.sequence,
      outPlayerRef: r.outPlayerId ? (playerRefById.get(r.outPlayerId) ?? null) : null,
      inPlayerRef: r.inPlayerId ? (playerRefById.get(r.inPlayerId) ?? null) : null,
      outPosition: r.outPosition,
      inPosition: r.inPosition,
    }))
    .sort((a, b) => a.sequence - b.sequence);
  for (const r of rotationFacts) evidenceRefs.add(`${FACT}:planned-rotation:${matchRef}:${r.sequence}`);

  // ---- per-player preparation summaries (positions, attributes, stats, development) ----

  const playerFacts = sortedPlayerIds
    .map((playerId) => {
      const summary = bundle.playerSummaries.get(playerId)!;
      const playerRef = playerRefById.get(playerId)!;
      return {
        ref: playerRef,
        declaredPositions: summary.declaredPositions,
        positionEvidence: summary.positionEvidence,
        attributes: summary.attributes,
        season: summary.season,
        recent: summary.recent,
        development: summary.development,
      };
    })
    .sort((a, b) => a.ref.localeCompare(b.ref));
  for (const p of playerFacts) {
    evidenceRefs.add(`${FACT}:player-profile:${p.ref}`);
    if (p.development.length > 0) evidenceRefs.add(`${FACT}:development-context:${p.ref}`);
  }

  // ---- combinations (established/new/goal) -- reused directly from the already-gated facts ----

  function launderPairFact(f: MatchInsightFact, slug: string) {
    const [a, b] = f.subjectRefs;
    const refA = playerRefById.get(a);
    const refB = playerRefById.get(b);
    if (!refA || !refB) return null;
    const pairRefs = [refA, refB].sort();
    // Fact values are always built from JSON-safe primitives/arrays/objects in
    // build-match-insight-facts.ts; `MatchInsightFact.value` is typed loosely (`Record<string,
    // unknown>`) per the bundle's own sketch, so this cast is a type-narrowing, not a runtime risk.
    return { evidenceRef: `${FACT}:${slug}:${pairRefs[0]}:${pairRefs[1]}`, playerRefs: pairRefs, value: f.value as JsonValue };
  }

  const combinationFacts = bundle.facts
    .filter((f) => f.type === "STARTS_TOGETHER" || f.type === "NEW_COMBINATION" || f.type === "GOAL_COMBINATION")
    .map((f) => {
      const slug = f.type === "STARTS_TOGETHER" ? "starts-together" : f.type === "NEW_COMBINATION" ? "new-combination" : "goal-combination";
      const laundered = launderPairFact(f, slug);
      return laundered ? { kind: f.type, ...laundered } : null;
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => a.evidenceRef.localeCompare(b.evidenceRef));
  for (const c of combinationFacts) evidenceRefs.add(c.evidenceRef);

  // ---- team history (formation familiarity, lineup continuity) -- no historical match id exposed ----

  const teamHistoryFact: JsonValue = {
    formationFamiliarity: bundle.teamHistory.formationFamiliarity,
    lineupContinuity: bundle.teamHistory.lineupContinuity
      ? {
          unchangedPlayerCount: bundle.teamHistory.lineupContinuity.unchangedPlayerCount,
          changedPlayerCount: bundle.teamHistory.lineupContinuity.changedPlayerCount,
          previousSquadSize: bundle.teamHistory.lineupContinuity.previousSquadSize,
        }
      : null,
  };
  if (bundle.teamHistory.formationFamiliarity) evidenceRefs.add(`${FACT}:formation-pattern:${matchRef}`);
  if (bundle.teamHistory.lineupContinuity?.previousMatchId) evidenceRefs.add(`${FACT}:lineup-continuity:${matchRef}`);

  // ---- rotation context (which inbound player has no recent starts) ----

  const rotationContextFacts = bundle.facts
    .filter((f) => f.type === "ROTATION_CONTEXT")
    .map((f) => {
      const value = f.value as { sequence: number; outPosition: string | null; inPosition: string | null; inboundRecentStarts: number | null };
      const outPlayerId = f.subjectRefs[0];
      const inPlayerId = f.subjectRefs[1];
      return {
        sequence: value.sequence,
        outPlayerRef: outPlayerId ? (playerRefById.get(outPlayerId) ?? null) : null,
        inPlayerRef: inPlayerId ? (playerRefById.get(inPlayerId) ?? null) : null,
        outPosition: value.outPosition,
        inPosition: value.inPosition,
        inboundRecentStarts: value.inboundRecentStarts,
      };
    })
    .sort((a, b) => a.sequence - b.sequence);
  for (const r of rotationContextFacts) evidenceRefs.add(`${FACT}:rotation-context:${r.sequence}`);

  // ---- exact-opponent history -- never any real match id; encounters distinguished by index only ----

  const opponentEncounterFacts = bundle.opponentContext.previousEncounters.map((e, index) => ({
    index: index + 1,
    occurredAt: e.occurredAt.toISOString().slice(0, 10),
    goalsFor: e.goalsFor,
    goalsAgainst: e.goalsAgainst,
    formation: e.formation,
    overallEnvironment: e.overallEnvironment,
    sportingLevel: e.sportingLevel,
    playingStyleTags: e.playingStyleTags,
    concernCategories: e.concernCategories,
    trustedObservation: e.trustedObservation
      ? { text: e.trustedObservation.text, source: e.trustedObservation.source }
      : null,
  }));
  if (bundle.opponentContext.exactOpponentHistoryAvailable) {
    evidenceRefs.add(`${FACT}:opponent-encounter:${matchRef}`);
    for (const e of opponentEncounterFacts) {
      if (e.overallEnvironment || e.trustedObservation) evidenceRefs.add(`${FACT}:opponent-observation:${matchRef}:${e.index}`);
    }
  }

  const opponentTrendFacts = bundle.opponentContext.establishedCombinationsAgainstOpponent
    .map((c) => {
      const refA = playerRefById.get(c.playerIds[0]);
      const refB = playerRefById.get(c.playerIds[1]);
      if (!refA || !refB) return null;
      const pairRefs = [refA, refB].sort();
      return { playerRefs: pairRefs, matchCount: c.matchCount, totalMinutesTogether: c.totalMinutesTogether };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => a.playerRefs[0].localeCompare(b.playerRefs[0]) || a.playerRefs[1].localeCompare(b.playerRefs[1]));
  if (opponentTrendFacts.length > 0) evidenceRefs.add(`${FACT}:opponent-trend:${matchRef}`);

  const opponentContextValue: JsonValue = {
    exactOpponentHistoryAvailable: bundle.opponentContext.exactOpponentHistoryAvailable,
    previousEncounterCount: bundle.opponentContext.previousEncounterCount,
    previousEncounters: opponentEncounterFacts,
    establishedCombinationsAgainstOpponent: opponentTrendFacts,
  };

  const normalizedContext: JsonValue = {
    match: { ref: matchRef, format: matchFormatFact },
    squad: squadFacts,
    formation: formationFact,
    plannedRotations: rotationFacts,
    players: playerFacts,
    combinations: combinationFacts.map((c) => ({ kind: c.kind, playerRefs: c.playerRefs, value: c.value })),
    teamHistory: teamHistoryFact,
    rotationContext: rotationContextFacts,
    opponentContext: opponentContextValue,
  };

  const instructions = [
    "Capability: match_prep. Prepare the coach for this exact match using only the supplied structured Matchboard context.",
    "Identify all materially useful preparation insights supported by the evidence -- do not produce observations merely to increase the count, and do not pad toward any particular number.",
    "Connect the current plan with player profiles, attributes, development context, statistics, team history, combinations, and exact-opponent history when relevant.",
    "Do not perform any internet lookup and do not infer anything from the opponent's name, club, or league reputation.",
    "Do not alter the line-up or rotations, and do not invent missing minutes or statistics.",
    "Do not label any player as strong, weak, better, or worse than another, and do not rank players.",
    "A trustedObservation is an attributed coach observation from a previous encounter, not a confirmed objective fact -- treat and describe it accordingly, never as settled truth.",
    "You may propose at most one development observation per player, only via the confirm_development_observation action, and only when a supplied fact clearly supports it -- every proposal requires explicit coach confirmation before it becomes real.",
  ].join(" ");

  return { normalizedContext, instructions, refMap, evidenceRefs };
}

export const matchPrepCapabilityHandler: AiCapabilityHandler = {
  capability: "MATCH_PREP",
  buildContext: buildMatchPrepContext,
};

registerAiCapabilityHandler(matchPrepCapabilityHandler);
