import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import type { RatingAttributeKey } from "@/lib/ratings/player-rating";
import { EVIDENCE_ENGINE_VERSION } from "./evidence-accumulator";
import { MAPPING_VERSION } from "./observation-mapping";

export type AssessmentChangeSource =
  | "AUTOMATIC"
  | "MANUAL_EDIT"
  | "MIGRATION"
  | "REBASE";

export type AssessmentChangeTargetType = "ATTRIBUTE" | "GOALKEEPER" | "POSITION";

export interface CreateAssessmentChangeInput {
  playerId: string;
  targetType: AssessmentChangeTargetType;
  attributeKey: RatingAttributeKey | null;
  targetDescription: string | null;
  beforeValue: number | null;
  afterValue: number | null;
  source: AssessmentChangeSource;
  reason: string | null;
  evidenceIds: string[];
  confidence: number | null;
  cutoverAt: Date | null;
}

export async function recordAssessmentChange(
  input: CreateAssessmentChangeInput,
): Promise<{ id: string }> {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const change = await db.assessmentChange.create({
    data: {
      organisationId: ctx.organisationId,
      playerId: input.playerId,
      targetType: input.targetType,
      attributeKey: input.attributeKey,
      targetDescription: input.targetDescription,
      beforeValue: input.beforeValue,
      afterValue: input.afterValue,
      source: input.source,
      reason: input.reason,
      evidenceIds: input.evidenceIds,
      engineVersion: EVIDENCE_ENGINE_VERSION,
      mappingVersion: MAPPING_VERSION,
      confidence: input.confidence,
      cutoverAt: input.cutoverAt,
    },
  });

  return { id: change.id };
}

export async function recordManualRebase(
  playerId: string,
  attributeKey: RatingAttributeKey | null,
  beforeValue: number | null,
  afterValue: number | null,
  reason: string | null,
): Promise<{ id: string }> {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const change = await db.assessmentChange.create({
    data: {
      organisationId: ctx.organisationId,
      playerId,
      targetType: "ATTRIBUTE",
      attributeKey,
      targetDescription: attributeKey ? `Manual rebase: ${attributeKey}` : null,
      beforeValue,
      afterValue,
      source: "MANUAL_EDIT",
      reason,
      evidenceIds: [],
      engineVersion: EVIDENCE_ENGINE_VERSION,
      mappingVersion: MAPPING_VERSION,
      confidence: null,
      cutoverAt: null,
      decidedAt: new Date(),
      decidedBy: ctx.userId,
    },
  });

  return { id: change.id };
}

export async function getAssessmentHistory(
  playerId: string,
  orgFilter: { type: "org"; organisationId: string; filter: object; filterNullable: object },
): Promise<Array<{
  id: string;
  targetType: string;
  attributeKey: string | null;
  targetDescription: string | null;
  beforeValue: number | null;
  afterValue: number | null;
  source: string;
  reason: string | null;
  engineVersion: string;
  mappingVersion: string;
  confidence: number | null;
  createdAt: Date;
}>> {
  if (orgFilter.type !== "org") return [];

  const rows = await db.assessmentChange.findMany({
    where: {
      playerId,
      ...orgFilter.filter,
    },
    select: {
      id: true,
      targetType: true,
      attributeKey: true,
      targetDescription: true,
      beforeValue: true,
      afterValue: true,
      source: true,
      reason: true,
      engineVersion: true,
      mappingVersion: true,
      confidence: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
    ...row,
    beforeValue: row.beforeValue ? Number(row.beforeValue) : null,
    afterValue: row.afterValue ? Number(row.afterValue) : null,
    confidence: row.confidence ? Number(row.confidence) : null,
  }));
}

export async function setPlayerEvidenceCutover(
  playerId: string,
  orgFilter: { type: "org"; organisationId: string; filter: object },
): Promise<void> {
  if (orgFilter.type !== "org") return;

  const now = new Date();
  await db.player.update({
    where: { id: playerId },
    data: { evidenceCutoverAt: now },
  });
}

export async function getPlayerEvidenceCutover(
  playerId: string,
  orgFilter: { type: "org"; organisationId: string; filter: object },
): Promise<Date | null> {
  if (orgFilter.type !== "org") return null;

  const player = await db.player.findFirst({
    where: { id: playerId, ...orgFilter.filter },
    select: { evidenceCutoverAt: true },
  });

  return player?.evidenceCutoverAt ?? null;
}