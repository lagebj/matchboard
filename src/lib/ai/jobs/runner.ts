import "server-only";
import { db } from "@/lib/db";
import {
  AiAdvisorReviewStatus,
  AiInsightActionType,
  AiInsightState,
  AiInsightSubjectType,
  Prisma,
  type AiAdvisorCapability,
  type AiAdvisorScopeType,
} from "@/generated/prisma/client";
import { runWithSystemPrivilege, runWithTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { logger } from "@/lib/logger";
import { getOrganisationAiSettings, isAiCapabilityEnabled } from "@/lib/ai/organisation-ai-settings";
import { getProviderConnection } from "@/lib/ai/provider-connections";
import { getAiCapabilityHandler, type AiCapabilityContext } from "@/lib/ai/jobs/capability-handler";
import { getProviderAdapter } from "@/lib/ai/providers/provider-adapter-registry";
import { fromPrismaAiProviderId } from "@/lib/ai/provider-registry";
import { withProviderCredential, ProviderCredentialAccessError } from "@/lib/ai/credential-access";
import { computeSourceFingerprint } from "@/lib/ai/fingerprints";
import { AI_ADVISOR_STABLE_DOCTRINE, AI_TERMINOLOGY_VERSION } from "@/lib/ai/terminology";
import { AI_CONTRACT_VERSION, toPrismaAiInsightKind } from "@/lib/ai/contracts";
import { validateAdvisorResponse } from "@/lib/ai/response-validation";

/**
 * The AI job runner (07_EXECUTION_PIPELINE.md "Queue" — the 13-step worker-run sequence). Claims
 * a bounded batch of due jobs atomically, then processes each independently: one job's failure
 * never blocks or corrupts another's.
 */

const BATCH_SIZE = 20;
/** +1min / +5min / +30min, per 07_EXECUTION_PIPELINE.md — index by `attempts` (0-based) after
 * incrementing for this failed attempt. */
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000];
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length;

/** Failure classes safe to retry — a transient provider/network condition that may clear up on
 * its own. Everything else (bad credential, incompatible model, invalid output) is terminal:
 * retrying with the exact same request would almost certainly reproduce the same failure. */
const RETRYABLE_ERROR_CODES = new Set(["PROVIDER_RATE_LIMITED", "PROVIDER_UNAVAILABLE", "PROVIDER_TIMEOUT"]);

interface ClaimedJobRow {
  id: string;
  organisationId: string;
  capability: AiAdvisorCapability;
  scopeType: AiAdvisorScopeType;
  scopeId: string;
  sourceFingerprint: string;
  attempts: number;
}

export interface ProcessAiJobsSummary {
  claimed: number;
  succeeded: number;
  failed: number;
  retried: number;
  skippedNotEligible: number;
}

/**
 * Atomically claims up to `limit` due jobs using Postgres `FOR UPDATE SKIP LOCKED` inside a
 * single `UPDATE ... RETURNING` statement — one statement is inherently atomic, so concurrent
 * cron invocations can never claim the same job twice (07_EXECUTION_PIPELINE.md: "Claim work
 * using atomic database semantics"). `AiAdvisorJob` is RLS-scoped and this scan is intentionally
 * cross-organisation, so it runs under `runWithSystemPrivilege` per this repo's established
 * convention (ADR-0087) — though raw `$queryRaw` calls bypass the `tenantRLS` Prisma extension
 * entirely regardless, this keeps every intentionally-unscoped call site greppable.
 */
async function claimDueJobs(limit: number): Promise<ClaimedJobRow[]> {
  const claimToken = crypto.randomUUID();
  return runWithSystemPrivilege("ai-job-runner-atomic-claim", () =>
    db.$queryRaw<ClaimedJobRow[]>`
      UPDATE "AiAdvisorJob"
      SET status = 'RUNNING', "lockedAt" = NOW(), "lockedBy" = ${claimToken}, "updatedAt" = NOW()
      WHERE id IN (
        SELECT id FROM "AiAdvisorJob"
        WHERE status = 'QUEUED' AND "nextAttemptAt" <= NOW()
        ORDER BY "nextAttemptAt" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, "organisationId", capability, "scopeType", "scopeId", "sourceFingerprint", attempts
    `,
  );
}

async function markJobFailed(jobId: string, errorCode: string): Promise<void> {
  await db.aiAdvisorJob.update({
    where: { id: jobId },
    data: { status: "FAILED", lastErrorCode: errorCode, lockedAt: null, lockedBy: null },
  });
}

async function markJobRetry(jobId: string, attempts: number, errorCode: string): Promise<void> {
  const delayMs = RETRY_DELAYS_MS[attempts - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
  await db.aiAdvisorJob.update({
    where: { id: jobId },
    data: {
      status: "QUEUED",
      attempts,
      nextAttemptAt: new Date(Date.now() + delayMs),
      lastErrorCode: errorCode,
      lockedAt: null,
      lockedBy: null,
    },
  });
}

async function markJobSucceeded(jobId: string): Promise<void> {
  await db.aiAdvisorJob.update({
    where: { id: jobId },
    data: { status: "SUCCEEDED", lockedAt: null, lockedBy: null },
  });
}

function resolveErrorOutcome(job: ClaimedJobRow, errorCode: string): "retry" | "fail" {
  const attemptsAfterThisFailure = job.attempts + 1;
  if (RETRYABLE_ERROR_CODES.has(errorCode) && attemptsAfterThisFailure < MAX_ATTEMPTS) {
    return "retry";
  }
  return "fail";
}

async function handleFailure(job: ClaimedJobRow, errorCode: string): Promise<"retried" | "failed"> {
  const outcome = resolveErrorOutcome(job, errorCode);
  if (outcome === "retry") {
    await markJobRetry(job.id, job.attempts + 1, errorCode);
    return "retried";
  }
  await markJobFailed(job.id, errorCode);
  return "failed";
}

/** Resolves an ephemeral subject ref (or null) to `{ subjectType, subjectId }` for persistence.
 * An unresolvable ref cannot reach here — `response-validation.ts`'s semantic stage already
 * rejected the whole response if any ref wasn't in `context.refMap`. */
function resolveSubject(ref: string | null, context: AiCapabilityContext): { subjectType: AiInsightSubjectType; subjectId: string | null } {
  if (ref === null) {
    return { subjectType: AiInsightSubjectType.NONE, subjectId: null };
  }
  const target = context.refMap.get(ref);
  // Defensive only — validateAdvisorSemantics() already guarantees this ref is in refMap's keys
  // by construction (refMap.keys() is exactly what's passed as allowedSubjectRefs).
  if (!target) {
    return { subjectType: AiInsightSubjectType.NONE, subjectId: null };
  }
  return { subjectType: target.subjectType, subjectId: target.entityId };
}

async function processClaimedJob(job: ClaimedJobRow): Promise<"succeeded" | "failed" | "retried" | "not_eligible"> {
  return runWithTenantOrganisationId(job.organisationId, async () => {
    const handler = getAiCapabilityHandler(job.capability);
    if (!handler) {
      // Not a real operational state once every capability is wired — defensive only.
      await markJobFailed(job.id, "NO_CAPABILITY_HANDLER");
      return "failed";
    }

    const settings = await getOrganisationAiSettings(job.organisationId);
    const capabilityEnabled = settings ? isAiCapabilityEnabled(settings, job.capability) : false;
    if (!settings?.enabled || !capabilityEnabled || !settings.activeConnectionId) {
      await markJobFailed(job.id, "NOT_ELIGIBLE");
      return "not_eligible";
    }

    const connection = await getProviderConnection(job.organisationId, settings.activeConnectionId);
    if (!connection || connection.status !== "READY" || !connection.model) {
      await markJobFailed(job.id, "NOT_ELIGIBLE");
      return "not_eligible";
    }

    const context = await handler.buildContext({ organisationId: job.organisationId, scopeId: job.scopeId });
    if (!context) {
      await markJobFailed(job.id, "SCOPE_NO_LONGER_ELIGIBLE");
      return "failed";
    }

    // The context is rebuilt fresh at run time, not read back from the job row — using the
    // freshly computed fingerprint (rather than the job's own, potentially now-stale,
    // sourceFingerprint) keeps the persisted review honest about exactly what it reviewed.
    const currentFingerprint = computeSourceFingerprint(context.normalizedContext);

    const alreadySucceeded = await db.aiAdvisorReview.findFirst({
      where: {
        organisationId: job.organisationId,
        capability: job.capability,
        scopeType: job.scopeType,
        scopeId: job.scopeId,
        sourceFingerprint: currentFingerprint,
        status: "SUCCEEDED",
      },
      select: { id: true },
    });
    if (alreadySucceeded) {
      await markJobSucceeded(job.id);
      return "succeeded";
    }

    const providerWireId = fromPrismaAiProviderId(connection.provider);
    const adapter = getProviderAdapter(providerWireId);
    const model = connection.model;
    const instructions = `${AI_ADVISOR_STABLE_DOCTRINE} ${context.instructions}`;

    let executeResult: Awaited<ReturnType<typeof adapter.executeReview>>;
    try {
      executeResult = await withProviderCredential(settings.activeConnectionId, (credential) =>
        adapter.executeReview({ credential, model, instructions, input: context.normalizedContext }),
      );
    } catch (error) {
      const errorCode = error instanceof ProviderCredentialAccessError ? error.errorCode : "PROVIDER_UNAVAILABLE";
      const outcome = await handleFailure(job, errorCode);
      logger.warn({ jobId: job.id, capability: job.capability, errorCode, outcome }, "[ai/jobs/runner] Credential access failed");
      return outcome;
    }

    if (!executeResult.ok) {
      const outcome = await handleFailure(job, executeResult.errorCode);
      logger.warn(
        { jobId: job.id, capability: job.capability, errorCode: executeResult.errorCode, outcome },
        "[ai/jobs/runner] Provider execution failed",
      );
      return outcome;
    }

    const validation = validateAdvisorResponse(executeResult.raw, {
      subjectRefs: new Set(context.refMap.keys()),
      evidenceRefs: context.evidenceRefs,
    });
    if (!validation.valid) {
      // Never retried — the same context/instructions would almost certainly reproduce the same
      // invalid output (07_EXECUTION_PIPELINE.md: "No provider output bypasses local validation").
      await markJobFailed(job.id, "PROVIDER_OUTPUT_INVALID");
      logger.warn(
        { jobId: job.id, capability: job.capability, reason: validation.reason },
        "[ai/jobs/runner] Provider output failed local validation",
      );
      return "failed";
    }

    await persistSuccessfulReview({
      organisationId: job.organisationId,
      capability: job.capability,
      scopeType: job.scopeType,
      scopeId: job.scopeId,
      sourceFingerprint: currentFingerprint,
      providerConnectionId: settings.activeConnectionId,
      provider: connection.provider,
      model,
      inputTokens: executeResult.inputTokens,
      outputTokens: executeResult.outputTokens,
      providerRequestDurationMs: executeResult.durationMs,
      summary: validation.response.summary,
      insights: validation.response.insights,
      context,
    });

    if (validation.response.insights.length === 0) {
      // A schema-valid, zero-insight response is a legitimate outcome (advisor instructions
      // explicitly allow "nothing materially useful to report" rather than padding), and the
      // presentation layer intentionally renders no Advisor card for it ("no empty Advisor
      // card"). But from an operator's standpoint this is indistinguishable from "everything is
      // fine" unless it's logged: the provider call still consumed quota/tokens and the review
      // still shows SUCCEEDED, yet nothing reaches the UI. Surface it so a model/connection that
      // is *systematically* returning empty insights (e.g. too weak to reliably produce the
      // required ephemeral/evidence refs) is visible in logs rather than silently invisible.
      logger.warn(
        { jobId: job.id, organisationId: job.organisationId, capability: job.capability, model, provider: connection.provider },
        "[ai/jobs/runner] Review succeeded with zero insights -- Advisor UI will show nothing for this review",
      );
    }

    await markJobSucceeded(job.id);
    return "succeeded";
  });
}

interface PersistSuccessfulReviewParams {
  organisationId: string;
  capability: AiAdvisorCapability;
  scopeType: AiAdvisorScopeType;
  scopeId: string;
  sourceFingerprint: string;
  providerConnectionId: string;
  provider: Parameters<typeof fromPrismaAiProviderId>[0];
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  providerRequestDurationMs: number;
  summary: string;
  insights: {
    kind: string;
    subjectRef: string | null;
    secondarySubjectRef: string | null;
    title: string;
    body: string;
    evidenceRefs: string[];
    suggestedAction: { type: string; playerRef: string; category: string; observation: string } | null;
  }[];
  context: AiCapabilityContext;
}

async function persistSuccessfulReview(params: PersistSuccessfulReviewParams): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.aiAdvisorReview.updateMany({
      where: {
        organisationId: params.organisationId,
        capability: params.capability,
        scopeType: params.scopeType,
        scopeId: params.scopeId,
        status: "SUCCEEDED",
      },
      data: { status: AiAdvisorReviewStatus.SUPERSEDED },
    });

    const review = await tx.aiAdvisorReview.create({
      data: {
        organisationId: params.organisationId,
        capability: params.capability,
        scopeType: params.scopeType,
        scopeId: params.scopeId,
        sourceFingerprint: params.sourceFingerprint,
        status: AiAdvisorReviewStatus.SUCCEEDED,
        providerConnectionId: params.providerConnectionId,
        provider: params.provider,
        model: params.model,
        contractVersion: AI_CONTRACT_VERSION,
        terminologyVersion: AI_TERMINOLOGY_VERSION,
        summary: params.summary,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        providerRequestDurationMs: params.providerRequestDurationMs,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    for (const insight of params.insights) {
      const subject = resolveSubject(insight.subjectRef, params.context);
      const secondary = insight.secondarySubjectRef ? resolveSubject(insight.secondarySubjectRef, params.context) : null;

      const actionPayload =
        insight.suggestedAction === null
          ? null
          : {
              playerId: resolveSubject(insight.suggestedAction.playerRef, params.context).subjectId,
              category: insight.suggestedAction.category,
              observation: insight.suggestedAction.observation,
            };

      await tx.aiAdvisorInsight.create({
        data: {
          organisationId: params.organisationId,
          reviewId: review.id,
          kind: toPrismaAiInsightKind(insight.kind as Parameters<typeof toPrismaAiInsightKind>[0]),
          subjectType: subject.subjectType,
          subjectId: subject.subjectId,
          secondarySubjectId: secondary?.subjectId ?? null,
          title: insight.title,
          body: insight.body,
          evidenceRefs: insight.evidenceRefs as Prisma.InputJsonValue,
          actionType: insight.suggestedAction === null ? AiInsightActionType.NONE : AiInsightActionType.CONFIRM_DEVELOPMENT_OBSERVATION,
          actionPayload: actionPayload as Prisma.InputJsonValue | undefined,
          state: AiInsightState.ACTIVE,
        },
      });
    }
  });
}

/** Entry point for the cron route: claims and processes one bounded batch of due jobs. */
export async function processAiJobsBatch(): Promise<ProcessAiJobsSummary> {
  const claimed = await claimDueJobs(BATCH_SIZE);

  const summary: ProcessAiJobsSummary = { claimed: claimed.length, succeeded: 0, failed: 0, retried: 0, skippedNotEligible: 0 };

  for (const job of claimed) {
    try {
      const outcome = await processClaimedJob(job);
      if (outcome === "succeeded") summary.succeeded++;
      else if (outcome === "retried") summary.retried++;
      else if (outcome === "not_eligible") summary.skippedNotEligible++;
      else summary.failed++;
    } catch (error) {
      logger.error({ err: error, jobId: job.id, capability: job.capability }, "[ai/jobs/runner] Unexpected error processing job");
      try {
        await markJobFailed(job.id, "UNEXPECTED_ERROR");
      } catch (markError) {
        logger.error({ err: markError, jobId: job.id }, "[ai/jobs/runner] Failed to mark job as failed after unexpected error");
      }
      summary.failed++;
    }
  }

  return summary;
}
