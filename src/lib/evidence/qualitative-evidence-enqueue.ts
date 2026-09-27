import "server-only";

import { db } from "@/lib/db";
import { getOrganisationAiSettings } from "@/lib/ai/organisation-ai-settings";
import { computeSourceFingerprint, type JsonValue } from "@/lib/ai/fingerprints";
import type { QualitativeEvidenceSourceType } from "@/generated/prisma/client";

/**
 * Bundle §8 step 7 "queue unstructured AI extraction after commit" (ADR-0152 §4). Called only
 * after the debrief's own submit transaction has already committed — never inside it (bundle
 * §8: "Do not call provider inside transaction or request path").
 */
export type EnqueueQualitativeExtractionInput = {
  organisationId: string;
  sourceType: QualitativeEvidenceSourceType;
  sourceId: string;
  /** Same fingerprint-payload convention as `recordDeterministicExtraction` (bundle §10). */
  fingerprintPayload: JsonValue;
};

export type EnqueueQualitativeExtractionResult =
  | { status: "AI_DISABLED" }
  | { status: "ALREADY_TRACKED"; runId: string }
  | { status: "QUEUED"; runId: string };

/**
 * Idempotent enqueue: never creates a second row for a fingerprint already tracked (bundle §9
 * "same normalized source content must not enqueue again"), whatever that existing row's current
 * status. When AI is disabled or has no active connection, deliberately does not enqueue at all
 * (bundle §10 "AI disabled": "Source text is preserved for future backfill if AI is later
 * enabled" — an abandoned QUEUED row for now-unchanged text would block a fresh enqueue once AI
 * is re-enabled, since the unique index is keyed by fingerprint, not by "was ever attempted").
 * Never supersedes any existing successful evidence itself — only a claimed run's own *success*
 * does that (bundle §11: "never replace good evidence with a failed run").
 */
export async function enqueueQualitativeExtraction(input: EnqueueQualitativeExtractionInput): Promise<EnqueueQualitativeExtractionResult> {
  const settings = await getOrganisationAiSettings(input.organisationId);
  if (!settings?.enabled || !settings.activeConnectionId) {
    return { status: "AI_DISABLED" };
  }

  const sourceFingerprint = computeSourceFingerprint(input.fingerprintPayload);
  const existing = await db.qualitativeEvidenceExtractionRun.findFirst({
    where: { organisationId: input.organisationId, sourceType: input.sourceType, sourceId: input.sourceId, sourceFingerprint },
    select: { id: true },
  });
  if (existing) return { status: "ALREADY_TRACKED", runId: existing.id };

  const run = await db.qualitativeEvidenceExtractionRun.create({
    data: {
      organisationId: input.organisationId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceFingerprint,
      derivationMethod: "AI_STRUCTURED",
      status: "QUEUED",
    },
  });
  return { status: "QUEUED", runId: run.id };
}
