import "server-only";
import { db } from "@/lib/db";
import { Prisma, type AiAdvisorCapability, type AiAdvisorScopeType } from "@/generated/prisma/client";

/**
 * Job enqueueing (07_EXECUTION_PIPELINE.md "Source fingerprint" / "Domain triggers"). Deliberately
 * capability-agnostic: this module takes an already-computed `sourceFingerprint` — building the
 * normalized context that fingerprint is derived from is each capability's own `context/*.ts`
 * builder's job (a later PR), not this one's. Real domain trigger call-sites (round finalised,
 * plan saved, post-match report submitted) land alongside each capability's own PR too, for the
 * same reason — a trigger can't call this usefully before there is a real fingerprint to enqueue.
 */

export type EnqueueAiJobOutcome =
  | { enqueued: true }
  | { enqueued: false; reason: "ALREADY_SUCCEEDED" | "ALREADY_QUEUED_OR_RUNNING" };

export interface EnqueueAiJobParams {
  organisationId: string;
  capability: AiAdvisorCapability;
  scopeType: AiAdvisorScopeType;
  scopeId: string;
  sourceFingerprint: string;
}

/**
 * Enqueues a job unless either (a) a SUCCEEDED review already exists for this exact
 * organisation/capability/scope/fingerprint (07_EXECUTION_PIPELINE.md: "do not enqueue" in that
 * case — the existing result is simply reused), or (b) a job for this exact fingerprint is
 * already queued or running (enforced by `AiAdvisorJob`'s own DB-level unique constraint, not
 * just this check — closes the duplicate-enqueue race a plain existence check alone would leave
 * open under concurrent callers).
 */
export async function enqueueAiJob(params: EnqueueAiJobParams): Promise<EnqueueAiJobOutcome> {
  const existingReview = await db.aiAdvisorReview.findFirst({
    where: {
      organisationId: params.organisationId,
      capability: params.capability,
      scopeType: params.scopeType,
      scopeId: params.scopeId,
      sourceFingerprint: params.sourceFingerprint,
      status: "SUCCEEDED",
    },
    select: { id: true },
  });
  if (existingReview) {
    return { enqueued: false, reason: "ALREADY_SUCCEEDED" };
  }

  try {
    await db.aiAdvisorJob.create({
      data: {
        organisationId: params.organisationId,
        capability: params.capability,
        scopeType: params.scopeType,
        scopeId: params.scopeId,
        sourceFingerprint: params.sourceFingerprint,
      },
    });
    return { enqueued: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { enqueued: false, reason: "ALREADY_QUEUED_OR_RUNNING" };
    }
    throw error;
  }
}
