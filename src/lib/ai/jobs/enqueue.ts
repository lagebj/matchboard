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
 * Finds an existing job for this exact organisation/capability/scope/fingerprint that is
 * terminally `FAILED` and, if one exists, revives it in place (back to `QUEUED`, `attempts`
 * reset to 0, `lastErrorCode` cleared) instead of leaving the caller to `create()` a duplicate
 * row and collide with the DB's unique constraint. Returns `true` if a row was revived (the
 * caller should treat this as "enqueued" and skip its own `create()`), `false` if no `FAILED`
 * row exists for this exact fingerprint (the caller should proceed to `create()` normally, or —
 * for a genuinely still-`QUEUED`/`RUNNING` duplicate — let that `create()` hit the unique
 * constraint and report `ALREADY_QUEUED_OR_RUNNING` as before).
 */
async function reviveFailedJobIfPresent(params: EnqueueAiJobParams): Promise<boolean> {
  const { count } = await db.aiAdvisorJob.updateMany({
    where: {
      organisationId: params.organisationId,
      capability: params.capability,
      scopeType: params.scopeType,
      scopeId: params.scopeId,
      sourceFingerprint: params.sourceFingerprint,
      status: "FAILED",
    },
    data: { status: "QUEUED", attempts: 0, lastErrorCode: null, lockedAt: null, lockedBy: null },
  });
  return count > 0;
}

/**
 * Enqueues a job unless either (a) a SUCCEEDED review already exists for this exact
 * organisation/capability/scope/fingerprint (07_EXECUTION_PIPELINE.md: "do not enqueue" in that
 * case — the existing result is simply reused), or (b) a job for this exact fingerprint is
 * already queued or running (enforced by `AiAdvisorJob`'s own DB-level unique constraint, not
 * just this check — closes the duplicate-enqueue race a plain existence check alone would leave
 * open under concurrent callers).
 *
 * Revives a terminally `FAILED` job for the same fingerprint back to `QUEUED` (resetting
 * `attempts`/`lastErrorCode`) rather than trying to `create()` a second row and hitting the
 * unique constraint. `FAILED` means "exhausted retries against this exact content", not "this
 * content has been reviewed" (only `SUCCEEDED` — already handled above — means that) — a new
 * domain trigger reproducing the identical fingerprint is a legitimate reason to try again (the
 * failure's cause, e.g. a since-fixed provider/model choice, may no longer apply). Without this,
 * any capability's job would get stuck forever the moment it failed all its retries while its
 * scope's content stayed byte-for-byte identical: every later trigger's `create()` would throw
 * `P2002`, indistinguishable here from a genuinely in-flight duplicate, permanently blocking any
 * future attempt for that scope+fingerprint. Found in production (2026-09-21/22): a
 * `lineup_review` job exhausted 3 retries against `PROVIDER_TIMEOUT` from an oversized model; the
 * coach switched to a faster model and edited the line-up again, but no new review was ever
 * produced because the edit reproduced the same fingerprint as the exhausted job.
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
    const revived = await reviveFailedJobIfPresent(params);
    if (revived) {
      return { enqueued: true };
    }

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
        return;
      }

      // No still-QUEUED row to collapse into — but if the *exact same fingerprint* already
      // exhausted its retries and is sitting terminally FAILED, revive it in place rather than
      // trying to `create()` a second row and colliding with the unique constraint. See
      // `reviveFailedJobIfPresent`'s doc comment for why FAILED must not permanently block a
      // later identical-content trigger the way SUCCEEDED correctly does.
      const revived = await tx.aiAdvisorJob.updateMany({
        where: {
          organisationId: params.organisationId,
          capability: params.capability,
          scopeType: params.scopeType,
          scopeId: params.scopeId,
          sourceFingerprint: params.sourceFingerprint,
          status: "FAILED",
        },
        data: { status: "QUEUED", nextAttemptAt, attempts: 0, lastErrorCode: null, lockedAt: null, lockedBy: null },
      });
      if (revived.count > 0) return;

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
    });
    return { enqueued: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { enqueued: false, reason: "ALREADY_QUEUED_OR_RUNNING" };
    }
    throw error;
  }
}
