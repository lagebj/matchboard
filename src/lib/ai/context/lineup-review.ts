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
import { withEvidenceRef } from "@/lib/ai/context/evidence-ref";
import { ROLE_TYPE_LABELS, type FormationSlotRoleType } from "@/lib/formations/types";

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
 * Deliberately narrows the "may include" list: "evidence-backed positional exposure" is not
 * built as a separate fact here — a dedicated positional-exposure aggregate would duplicate the
 * existing `position-exposure` insight rather than add new capability-specific signal, the same
 * bounded-subset scope adaptation `post_match_review` and `round_review` already documented.
 *
 * "Coach-declared positions" *is* built (via `assignedPosition` on each squad fact), sourced from
 * `MatchLineup`/`MatchLineupAssignment` (the Tactics panel's formation-slot assignments) when a
 * lineup exists for this match's own team, falling back to the player's `primaryPosition`
 * otherwise. ARR-0051 documents that this builder previously read only `Selection` — never
 * `MatchLineup` — so a coach moving a player to a different formation slot on the Tactics panel
 * produced no signal the Advisor could see at all, even though `Selection` (role/eligibility) and
 * `MatchLineup` (on-pitch shape/position) both legitimately describe different, coexisting facts
 * about the same match. `Selection` remains authoritative for role (`CORE`/`SUPPORT`/etc.);
 * `MatchLineup` is authoritative for slot/position, matching how `MatchLineupAssignment.playerId`
 * is the coach's literal record of where a player is actually placed on the pitch for this match.
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

  // ARR-0051: the Tactics panel's formation-slot assignments (`MatchLineup`/
  // `MatchLineupAssignment`) are the coach's actual on-pitch position record for this match --
  // distinct from, and not derivable from, `Selection` or `Player.primaryPosition`. Read it here
  // so a lineup-only edit (no `Selection` change) is actually reflected in what the Advisor sees.
  const lineup = await db.matchLineup.findFirst({
    where: { matchId: match.id, teamId: match.teamId, organisationId: params.organisationId },
    select: {
      formation: { select: { id: true, name: true, gameFormat: true } },
      assignments: { where: { playerId: { not: null } }, select: { playerId: true, slotId: true, locked: true } },
    },
  });
  const assignedSlotByPlayer = new Map(lineup?.assignments.map((a) => [a.playerId!, a]) ?? []);
  const slotIds = [...new Set([...assignedSlotByPlayer.values()].map((a) => a.slotId))];
  const slots = slotIds.length
    ? await db.formationSlot.findMany({ where: { id: { in: slotIds } }, select: { id: true, roleType: true, label: true, gridX: true, gridY: true } })
    : [];
  const slotById = new Map(slots.map((s) => [s.id, s]));
  const assignedPositionByPlayer = new Map(
    [...assignedSlotByPlayer.entries()]
      .map(([playerId, a]) => [playerId, slotById.get(a.slotId)] as const)
      .filter((entry): entry is [string, NonNullable<(typeof slots)[number]>] => entry[1] !== undefined),
  );

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
    .map((s) => {
      const playerRef = playerRefById.get(s.playerId)!;
      const assignedSlot = assignedPositionByPlayer.get(s.playerId);
      return withEvidenceRef(evidenceRefs, `${FACT}:squad:${playerRef}`, {
        playerRef,
        role: String(s.role),
        position: positionByPlayer.get(s.playerId) ?? null,
        // ARR-0051: the coach's actual formation-slot assignment for this match, when a Tactics
        // panel lineup exists -- distinct from (and may differ from) `position` above, which is
        // just the player's own default `primaryPosition`.
        assignedPosition: assignedSlot ? (ROLE_TYPE_LABELS[assignedSlot.roleType as FormationSlotRoleType] ?? assignedSlot.roleType) : null,
      });
    })
    .sort((a, b) => a.playerRef.localeCompare(b.playerRef));

  const lineupFormationFact = lineup?.formation
    ? { name: lineup.formation.name, gameFormat: lineup.formation.gameFormat, assignedPlayerCount: assignedSlotByPlayer.size }
    : null;
  const formationFact =
    match.formation || lineupFormationFact
      ? withEvidenceRef(evidenceRefs, `${FACT}:formation:${matchRef}`, { matchRef, formation: match.formation, lineup: lineupFormationFact })
      : null;

  const rotationFacts = rotationChanges
    .map((c) =>
      withEvidenceRef(evidenceRefs, `${FACT}:planned-rotation:${matchRef}:${c.sequence}`, {
        sequence: c.sequence,
        outPlayerRef: c.outPlayerId ? playerRefById.get(c.outPlayerId) ?? null : null,
        inPlayerRef: c.inPlayerId ? playerRefById.get(c.inPlayerId) ?? null : null,
        outPosition: c.outPosition,
        inPosition: c.inPosition,
        approximateMatchSeconds: c.approximateMatchSeconds,
      }),
    )
    .sort((a, b) => a.sequence - b.sequence);

  const matchFormatFact = withEvidenceRef(evidenceRefs, `${FACT}:match-format:${matchRef}`, {
    matchRef,
    gameFormat: match.gameFormat,
    matchDurationMinutes: match.matchDurationMinutes,
  });

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
    .map((playerId) => {
      const playerRef = playerRefById.get(playerId)!;
      return withEvidenceRef(evidenceRefs, `${FACT}:opportunity:${playerRef}`, {
        playerRef,
        seasonAppearances: seasonAppearanceCounts.get(playerId) ?? 0,
      });
    })
    .sort((a, b) => a.playerRef.localeCompare(b.playerRef));

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
    "Every fact object that carries an evidenceRef field gives you the exact string to cite for that fact — copy it verbatim into an insight's evidenceRefs; never construct or guess your own evidence-ref string.",
    "You may propose at most one development observation per player, only via the confirm_development_observation action, and only when a supplied fact clearly supports it — every proposal requires explicit coach confirmation before it becomes real.",
  ].join(" ");

  return { normalizedContext, instructions, refMap, evidenceRefs };
}

export const lineupReviewCapabilityHandler: AiCapabilityHandler = {
  capability: "LINEUP_REVIEW",
  buildContext: buildLineupReviewContext,
};

registerAiCapabilityHandler(lineupReviewCapabilityHandler);
