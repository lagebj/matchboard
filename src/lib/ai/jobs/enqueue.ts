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

export interface EnqueueDebouncedAiJobParams extends EnqueueAiJobParams {
  /** How long to wait, from now, before this job becomes claimable — reset on every call for
   * the same organisation/capability/scope (06_AI_CAPABILITY_CONTRACTS.md "2. lineup_review":
   * "debounce 2 minutes after the last relevant plan change"). */
  debounceMs: number;
}

/**
 * Debounced variant of `enqueueAiJob` for capabilities whose trigger fires on every plan edit
 * rather than once at a clean state boundary (currently only `lineup_review`). Reuses the
 * runner's existing `WHERE status = 'QUEUED' AND "nextAttemptAt" <= NOW()` claim predicate
 * unchanged — no runner change was needed, only `nextAttemptAt` needed to be set in the future.
 *
 * "Collapse queued jobs for the same match/capability to the newest fingerprint"
 * (06_AI_CAPABILITY_CONTRACTS.md) is implemented by finding the single still-`QUEUED` job row
 * for this organisation/capability/scope (there is at most one, by construction below) and
 * updating it in place — rewriting its fingerprint and pushing `nextAttemptAt` out by another
 * `debounceMs` — rather than creating a second row. A `RUNNING`/already-claimed job is left
 * alone; the runner re-fetches the current fingerprint at execution time anyway, so a stale
 * in-flight job can never produce a wrong result, only a redundant one the runner already
 * dedupes against `AiAdvisorReview`.
 */
export async function enqueueDebouncedAiJob(params: EnqueueDebouncedAiJobParams): Promise<EnqueueAiJobOutcome> {
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

  const nextAttemptAt = new Date(Date.now() + params.debounceMs);

  try {
    await db.$transaction(async (tx) => {
      const existingQueuedJob = await tx.aiAdvisorJob.findFirst({
        where: {
          organisationId: params.organisationId,
          capability: params.capability,
          scopeType: params.scopeType,
          scopeId: params.scopeId,
          status: "QUEUED",
        },
        select: { id: true },
      });

      if (existingQueuedJob) {
        await tx.aiAdvisorJob.update({
          where: { id: existingQueuedJob.id },
          data: { sourceFingerprint: params.sourceFingerprint, nextAttemptAt, attempts: 0, lastErrorCode: null },
        });
      } else {
        await tx.aiAdvisorJob.create({
          data: {
            organisationId: params.organisationId,
            capability: params.capability,
            scopeType: params.scopeType,
            scopeId: params.scopeId,
            sourceFingerprint: params.sourceFingerprint,
            nextAttemptAt,
          },
        });
      }
    });
    return { enqueued: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { enqueued: false, reason: "ALREADY_QUEUED_OR_RUNNING" };
    }
    throw error;
  }
}
