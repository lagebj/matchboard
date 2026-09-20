import "server-only";
import "@/lib/ai/register-capabilities";
import type { AiAdvisorCapability, AiAdvisorScopeType } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";
import { getOrganisationAiSettings, isAiCapabilityEnabled } from "@/lib/ai/organisation-ai-settings";
import { getAiCapabilityHandler } from "@/lib/ai/jobs/capability-handler";
import { computeSourceFingerprint } from "@/lib/ai/fingerprints";
import { enqueueAiJob } from "@/lib/ai/jobs/enqueue";

/**
 * Domain-trigger entry point (07_EXECUTION_PIPELINE.md "Domain triggers"): football-domain
 * mutations (round finalised, plan saved, post-match report submitted) call this to enqueue AI
 * work. Never blocks the caller on provider execution — it only ever queues a DB row (or does
 * nothing) — and never throws: a misbehaving AI subsystem must never turn into a broken
 * report-completion/round-finalisation flow (07_EXECUTION_PIPELINE.md "Failure behavior").
 *
 * Builds the capability's own normalized context up front (via the same registry the job runner
 * uses) purely to compute its `sourceFingerprint` — 07_EXECUTION_PIPELINE.md "Source fingerprint":
 * "Before enqueueing: build normalized context object ... If a successful review exists for the
 * same organisation/capability/scope/fingerprint, do not enqueue." The job runner rebuilds this
 * same context again at execution time (state may have moved on by then); this duplication is
 * intentional, not a shortcut to remove.
 */
export async function triggerAiCapability(params: {
  organisationId: string;
  capability: AiAdvisorCapability;
  scopeType: AiAdvisorScopeType;
  scopeId: string;
}): Promise<void> {
  try {
    const settings = await getOrganisationAiSettings(params.organisationId);
    if (!settings?.enabled || !isAiCapabilityEnabled(settings, params.capability)) return;

    const handler = getAiCapabilityHandler(params.capability);
    if (!handler) return;

    const context = await handler.buildContext({ organisationId: params.organisationId, scopeId: params.scopeId });
    if (!context) return;

    const sourceFingerprint = computeSourceFingerprint(context.normalizedContext);
    await enqueueAiJob({
      organisationId: params.organisationId,
      capability: params.capability,
      scopeType: params.scopeType,
      scopeId: params.scopeId,
      sourceFingerprint,
    });
  } catch (error) {
    logger.warn(
      { err: error, organisationId: params.organisationId, capability: params.capability, scopeType: params.scopeType },
      "[ai/jobs/triggers] Failed to enqueue AI job",
    );
  }
}
