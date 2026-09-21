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
 * This only works when the caller has rebuilt the *same* `refMap` the review was originally
 * generated from — which is guaranteed whenever the review's `sourceFingerprint` still matches a
 * freshly-rebuilt context for the same scope (deterministic ref assignment from the same
 * deterministic input). A stale (fingerprint-mismatched) review must never reach this function;
 * callers are expected to show a "Plan changed" placeholder instead of resolved text in that case.
 */
export async function buildRefDisplayNameMap(refMap: Map<string, AiCapabilityRefTarget>): Promise<Map<string, string>> {
  const playerIds = [...refMap.values()].filter((t) => t.subjectType === AiInsightSubjectType.PLAYER).map((t) => t.entityId);
  const teamIds = [...refMap.values()].filter((t) => t.subjectType === AiInsightSubjectType.TEAM).map((t) => t.entityId);

  const [players, teams] = await Promise.all([
    playerIds.length
      ? db.player.findMany({ where: { id: { in: playerIds } }, select: { id: true, firstName: true, lastName: true } })
      : Promise.resolve([]),
    teamIds.length ? db.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  const playerNameById = new Map(players.map((p) => [p.id, `${p.firstName} ${p.lastName ?? ""}`.trim()]));
  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));

  const displayNameByRef = new Map<string, string>();
  for (const [ref, target] of refMap) {
    if (target.subjectType === AiInsightSubjectType.PLAYER) {
      const name = playerNameById.get(target.entityId);
      if (name) displayNameByRef.set(ref, name);
    } else if (target.subjectType === AiInsightSubjectType.TEAM) {
      const name = teamNameById.get(target.entityId);
      if (name) displayNameByRef.set(ref, name);
    }
    // MATCH/ROUND/PLAYER_PAIR/NONE refs are intentionally left unresolved — the viewer is
    // already looking at that one match/round, so a bare ref like `M01` carries no useful prose
    // substitution and prior capability builders never emit player-pair refs.
  }
  return displayNameByRef;
}

const REF_TOKEN_PATTERN = /\b[A-Z]{1,2}\d{2,3}\b/g;

/** Replaces every resolvable ref token in free text with its display name; unresolved tokens
 * (e.g. `M01`) are left as-is rather than stripped, since removing them could otherwise produce
 * a grammatically broken sentence. */
export function resolveInsightText(text: string, displayNameByRef: Map<string, string>): string {
  return text.replace(REF_TOKEN_PATTERN, (token) => displayNameByRef.get(token) ?? token);
}
