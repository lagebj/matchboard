import "server-only";
import { db } from "@/lib/db";
import { AiInsightSubjectType } from "@/generated/prisma/client";
import type { AiCapabilityRefTarget } from "@/lib/ai/jobs/capability-handler";

/**
 * Resolves the ephemeral entity refs (`P01`, `M01`, ...) that may still appear verbatim inside a
 * persisted insight's `title`/`body` prose back to real, locally-resolved display names
 * (14_GOLDEN_REFERENCE_GUIDE.md: "Names in this UI are resolved locally after the provider result
 * is validated. Names were not sent to the provider."; `terminology.ts`'s stable doctrine tells
 * the model to "use only the entity references supplied in the input ... never use a real name").
 *
 * Two map sources, in priority order:
 *
 * 1. **The review's own persisted `refMap`** (`AiAdvisorReview.refMap`, serialized at save time
 *    by the runner). This is the *exact* map the review's ref tokens were assigned from, so
 *    resolution is correct for every review regardless of freshness — stale reviews included.
 *    Found in production (2026-09-27, after the Slice-7 backfill landed new qualitative evidence
 *    and flipped every existing review's rebuilt context stale): the rebuild-only path below
 *    degraded every stale review to raw `P01`/`M01` tokens, which is exactly what this
 *    persisted map eliminates.
 * 2. **A rebuilt map from a fingerprint-fresh context** — the original mechanism, kept as the
 *    fallback for reviews persisted before the `refMap` column existed (their `refMap` is null).
 *    Ref assignment is deterministic over the same input, so a fingerprint-fresh rebuild agrees
 *    with the review's own numbering; a *stale* review's rebuilt map may not (the documented
 *    reason a stale review must never use the rebuild path — see
 *    `completed-match-advisor.ts`'s own `presentText` doctrine).
 */
export async function buildRefDisplayNameMap(refMap: Map<string, AiCapabilityRefTarget>): Promise<Map<string, string>> {
  const playerIds = [...refMap.values()].filter((t) => t.subjectType === AiInsightSubjectType.PLAYER).map((t) => t.entityId);
  const teamIds = [...refMap.values()].filter((t) => t.subjectType === AiInsightSubjectType.TEAM).map((t) => t.entityId);
  const matchIds = [...refMap.values()].filter((t) => t.subjectType === AiInsightSubjectType.MATCH).map((t) => t.entityId);
  const roundIds = [...refMap.values()].filter((t) => t.subjectType === AiInsightSubjectType.ROUND).map((t) => t.entityId);

  const [players, teams, matches, rounds] = await Promise.all([
    playerIds.length
      ? db.player.findMany({ where: { id: { in: playerIds } }, select: { id: true, firstName: true, lastName: true } })
      : Promise.resolve([]),
    teamIds.length ? db.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
    matchIds.length
      ? db.match.findMany({ where: { id: { in: matchIds } }, select: { id: true, opponent: true } })
      : Promise.resolve([] as { id: string; opponent: string }[]),
    roundIds.length
      ? db.matchRound.findMany({ where: { id: { in: roundIds } }, select: { id: true, name: true } })
      : Promise.resolve([] as { id: string; name: string }[]),
  ]);
  const playerNameById = new Map(players.map((p) => [p.id, `${p.firstName} ${p.lastName ?? ""}`.trim()]));
  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));
  const opponentByMatchId = new Map(matches.map((m) => [m.id, m.opponent]));
  const roundNameById = new Map(rounds.map((r) => [r.id, r.name]));

  const displayNameByRef = new Map<string, string>();
  for (const [ref, target] of refMap) {
    if (target.subjectType === AiInsightSubjectType.PLAYER) {
      const name = playerNameById.get(target.entityId);
      if (name) displayNameByRef.set(ref, name);
    } else if (target.subjectType === AiInsightSubjectType.TEAM) {
      const name = teamNameById.get(target.entityId);
      if (name) displayNameByRef.set(ref, name);
    } else if (target.subjectType === AiInsightSubjectType.MATCH) {
      // A match ref reads naturally as "the match vs <opponent>" wherever the token appears in
      // prose ("...in M02" -> "...in the match vs Rosenborg"). This matters most for the
      // multi-match capabilities (weekly/cycle), where M02 is a *different* match from the one
      // being viewed; for single-match capabilities the label still reads correctly since it is
      // that same match.
      const opponent = opponentByMatchId.get(target.entityId);
      if (opponent) displayNameByRef.set(ref, `the match vs ${opponent}`);
    } else if (target.subjectType === AiInsightSubjectType.ROUND) {
      const name = roundNameById.get(target.entityId);
      if (name) displayNameByRef.set(ref, name);
    }
    // PLAYER_PAIR/NONE refs are intentionally left unresolved — pair refs are never emitted by
    // the current builders and NONE has nothing to name.
  }
  return displayNameByRef;
}

/** Deserializes a review's persisted `refMap` JSON (`ref -> {subjectType, entityId}`) back into
 * a `Map<string, AiCapabilityRefTarget>`. Returns `null` for a null/malformed column — a
 * pre-column review, or a corrupt row — so callers fall back to the rebuild path. */
export function parsePersistedRefMap(raw: unknown): Map<string, AiCapabilityRefTarget> | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const map = new Map<string, AiCapabilityRefTarget>();
  for (const [ref, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof ref !== "string" || !/^[A-Z]{1,2}\d{2,4}$/.test(ref)) continue;
    if (value == null || typeof value !== "object" || Array.isArray(value)) continue;
    const target = value as { subjectType?: unknown; entityId?: unknown };
    if (typeof target.subjectType !== "string" || typeof target.entityId !== "string") continue;
    if (!Object.values(AiInsightSubjectType).includes(target.subjectType as AiInsightSubjectType)) continue;
    map.set(ref, { subjectType: target.subjectType as AiInsightSubjectType, entityId: target.entityId });
  }
  return map.size > 0 ? map : null;
}

const REF_TOKEN_PATTERN = /\b[A-Z]{1,2}\d{2,3}\b/g;

/** Replaces every resolvable ref token in free text with its display name; unresolved tokens
 * (e.g. `M01`) are left as-is rather than stripped, since removing them could otherwise produce
 * a grammatically broken sentence. */
export function resolveInsightText(text: string, displayNameByRef: Map<string, string>): string {
  return text.replace(REF_TOKEN_PATTERN, (token) => displayNameByRef.get(token) ?? token);
}
