import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { requireActorContext } from "@/lib/auth/actor-context";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { RATING_ATTRIBUTE_KEYS, type DevelopmentAttributeKey } from "./constants";
import { evaluateAttributeEvidence, computeAttributeProposal, type AttributeEvidenceResult, type AttributeSuggestion } from "./evidence";

export type SuggestionDecision = "ACCEPT" | "ADJUST" | "REJECT";

export async function evaluatePlayerAttributeSuggestions(
  playerId: string,
  orgFilter: OrgFilterMode,
): Promise<AttributeSuggestion[]> {
  if (orgFilter.type !== "org") return [];

  const player = await db.player.findFirst({
    where: { id: playerId, ...orgFilter.filter },
  });
  if (!player) return [];

  const lastDecision = await db.playerProfileSuggestion.findFirst({
    where: {
      playerId,
      targetType: "ATTRIBUTE",
      status: { in: ["ACCEPTED", "ADJUSTED", "REJECTED"] },
      attributeKey: { not: null },
    },
    orderBy: { decidedAt: "desc" },
  });

  const baselineAt = lastDecision?.decidedAt ?? null;

  const observations = await db.playerDevelopmentObservation.findMany({
    where: {
      playerId,
      kind: "ATTRIBUTE",
      ...orgFilter.filterNullable,
    },
    orderBy: { observedAt: "asc" },
  });

  const suggestions: AttributeSuggestion[] = [];

  for (const attrKey of RATING_ATTRIBUTE_KEYS) {
    const attrObs = observations.filter((o) => o.attributeKey === attrKey);

    if (attrObs.length === 0) continue;

    const evidence = evaluateAttributeEvidence(
      attrObs.map((o) => ({
        id: o.id,
        direction: o.direction,
        observedAt: o.observedAt,
        matchId: o.matchId,
        attributeKey: o.attributeKey,
      })),
      baselineAt,
    );

    if (!evidence) continue;

    evidence.playerId = playerId;
    evidence.attributeKey = attrKey as DevelopmentAttributeKey;

    const currentValue = player[attrKey as keyof typeof player] as number | null;
    const proposal = computeAttributeProposal(evidence, currentValue);

    if (!proposal) continue;

    const existing = await db.playerProfileSuggestion.findFirst({
      where: {
        playerId,
        targetType: "ATTRIBUTE",
        attributeKey: attrKey,
        status: "PENDING",
      },
    });

    if (existing) continue;

    suggestions.push(proposal);
  }

  return suggestions;
}

type JsonValue = Prisma.InputJsonValue;

export async function createOrUpdatePendingSuggestion(
  playerId: string,
  targetType: "ATTRIBUTE" | "POSITION",
  attributeKey: string | null,
  positionId: string | null,
  confidence: "MEDIUM" | "HIGH",
  direction: "POSITIVE" | "NEGATIVE",
  currentSnapshot: JsonValue,
  proposedSnapshot: JsonValue,
  evidenceSummary: JsonValue,
  orgFilter: OrgFilterMode,
): Promise<{ id: string; created: boolean }> {
  if (orgFilter.type !== "org") {
    throw new Error("Organisation access required");
  }

  const existing = await db.playerProfileSuggestion.findFirst({
    where: {
      playerId,
      targetType,
      attributeKey,
      positionId,
      status: "PENDING",
    },
  });

  if (existing) {
    await db.playerProfileSuggestion.update({
      where: { id: existing.id },
      data: {
        confidence,
        direction,
        currentSnapshot: currentSnapshot as JsonValue,
        proposedSnapshot: proposedSnapshot as JsonValue,
        evidenceSummary: evidenceSummary as JsonValue,
      },
    });
    return { id: existing.id, created: false };
  }

  const suggestion = await db.playerProfileSuggestion.create({
    data: {
      organisationId: orgFilter.organisationId,
      playerId,
      targetType,
      attributeKey,
      positionId,
      confidence,
      direction,
      currentSnapshot: currentSnapshot as JsonValue,
      proposedSnapshot: proposedSnapshot as JsonValue,
      evidenceSummary: evidenceSummary as JsonValue,
      status: "PENDING",
    },
  });

  return { id: suggestion.id, created: true };
}

export async function decideSuggestion(
  suggestionId: string,
  decision: SuggestionDecision,
  adjustedValue?: number,
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireActorContext();
  const orgFilter = ctx.orgFilter;

  if (orgFilter.type !== "org") {
    return { success: false, error: "Organisation access required" };
  }

  const suggestion = await db.playerProfileSuggestion.findUnique({
    where: { id: suggestionId },
  });

  if (!suggestion) {
    return { success: false, error: "Suggestion not found" };
  }

  if (suggestion.organisationId !== ctx.organisationId) {
    return { success: false, error: "Access denied" };
  }

  if (suggestion.status !== "PENDING") {
    return { success: false, error: "Only pending suggestions can be decided" };
  }

  if (suggestion.targetType === "ATTRIBUTE") {
    return decideAttributeSuggestion(suggestion, decision, adjustedValue, ctx.userId);
  }

  return { success: false, error: "Position suggestion decisions not yet implemented" };
}

async function decideAttributeSuggestion(
  suggestion: Prisma.PlayerProfileSuggestionGetPayload<Record<string, never>>,
  decision: SuggestionDecision,
  adjustedValue: number | undefined,
  coachId: string,
): Promise<{ success: boolean; error?: string }> {
  const player = await db.player.findUnique({
    where: { id: suggestion.playerId },
  });

  if (!player) {
    return { success: false, error: "Player not found" };
  }

  const attrKey = suggestion.attributeKey as DevelopmentAttributeKey;
  const currentValue = player[attrKey as keyof typeof player] as number | null;
  const currentSnapshotObj = suggestion.currentSnapshot as Record<string, unknown> | null;
  const snapshotValue = (currentSnapshotObj?.value as number | null) ?? null;

  if (currentValue !== snapshotValue && currentValue !== null && snapshotValue !== null) {
    return { success: false, error: "Player attribute has changed since suggestion was created. Please re-evaluate." };
  }

  let finalValue: number | null;
  let status: "ACCEPTED" | "ADJUSTED" | "REJECTED";

  if (decision === "REJECT") {
    finalValue = null;
    status = "REJECTED";
  } else if (decision === "ACCEPT") {
    const proposedObj = suggestion.proposedSnapshot as Record<string, unknown> | null;
    finalValue = (proposedObj?.value as number | null) ?? null;
    status = "ACCEPTED";
  } else {
    if (adjustedValue === undefined || adjustedValue < 1 || adjustedValue > 10) {
      return { success: false, error: "Adjusted value must be between 1 and 10" };
    }
    finalValue = adjustedValue;
    status = "ADJUSTED";
  }

  if (finalValue !== null && attrKey && RATING_ATTRIBUTE_KEYS.includes(attrKey)) {
    const proposedObj = suggestion.proposedSnapshot as Record<string, unknown> | null;
    const updatedProposedSnapshot: JsonValue = status === "ADJUSTED"
      ? { ...proposedObj, value: adjustedValue, adjustedFrom: (proposedObj as Record<string, unknown> | null)?.value ?? null }
      : (suggestion.proposedSnapshot as JsonValue);

    await db.$transaction([
      db.player.update({
        where: { id: suggestion.playerId },
        data: { [attrKey]: finalValue, lastRatedAt: new Date() },
      }),
      db.playerProfileSuggestion.update({
        where: { id: suggestion.id },
        data: {
          status,
          decidedAt: new Date(),
          decidedBy: coachId,
          proposedSnapshot: updatedProposedSnapshot,
        },
      }),
      db.decisionRecord.create({
        data: {
          organisationId: suggestion.organisationId,
          decisionType: "PLAYER_ATTRIBUTE_SUGGESTION",
          entityType: "Player",
          entityId: suggestion.playerId,
          action: status,
          reason: `Suggestion ${suggestion.id}: ${attrKey} ${suggestion.direction}`,
          createdBy: coachId,
          beforeSnapshot: { value: currentValue } as JsonValue,
          afterSnapshot: { value: finalValue } as JsonValue,
        },
      }),
    ]);
  } else if (decision === "REJECT") {
    await db.playerProfileSuggestion.update({
      where: { id: suggestion.id },
      data: {
        status: "REJECTED",
        decidedAt: new Date(),
        decidedBy: coachId,
      },
    });
  }

  return { success: true };
}

export async function getPendingSuggestions(
  playerId: string,
  orgFilter: OrgFilterMode,
): Promise<Prisma.PlayerProfileSuggestionGetPayload<Record<string, never>>[]> {
  if (orgFilter.type !== "org") return [];

  return db.playerProfileSuggestion.findMany({
    where: {
      playerId,
      status: "PENDING",
      ...orgFilter.filter,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSuggestionHistory(
  playerId: string,
  orgFilter: OrgFilterMode,
): Promise<Prisma.PlayerProfileSuggestionGetPayload<Record<string, never>>[]> {
  if (orgFilter.type !== "org") return [];

  return db.playerProfileSuggestion.findMany({
    where: {
      playerId,
      status: { in: ["ACCEPTED", "ADJUSTED", "REJECTED"] },
      ...orgFilter.filter,
    },
    orderBy: { decidedAt: "desc" },
  });
}