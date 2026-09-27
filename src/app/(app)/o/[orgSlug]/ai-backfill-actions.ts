"use server";

import { requireActorContext, canAdmin } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { logSecurityEvent } from "@/lib/security/audit-log";
import { runAiBackfill, type AiBackfillReport } from "@/lib/evidence/qualitative-evidence-backfill";

/**
 * "Run AI analysis on existing data" transient admin tool (ADR-0152 Slice 7 — the user-requested
 * widening of the bundle's bounded backfill: not just legacy qualitative extraction, but *all*
 * AI functions over already-existing data). Mirrors the "Rebuild historical evidence" /
 * "Populate opponent levels" tools' operational pattern exactly — org-admin-only, org-scoped,
 * safe to rerun (every enqueue is fingerprint-idempotent; unchanged data never re-runs).
 *
 * Only ever *enqueues* work — no provider is called synchronously here, so the action returns as
 * soon as the queue rows exist and the existing `/api/cron/ai` scheduler processes them within
 * its normal cadence (bundle §9: extraction/advisor processing is cron work, never request work).
 */
export async function runAiBackfillAction(orgSlug: string): Promise<AiBackfillReport> {
  const ctx = await requireActorContext(orgSlug);
  if (!canAdmin(ctx)) {
    throw new Error("Admin access required");
  }
  setTenantOrganisationId(ctx.organisationId);

  const report = await runAiBackfill(ctx.organisationId);

  logSecurityEvent({
    category: "mutation",
    action: "run_ai_backfill",
    actor: ctx.userId,
    tenant: ctx.organisationId,
    resource: "ai_backfill",
    resourceId: orgSlug,
    result: "success",
    metadata: {
      aiDisabled: report.aiDisabled,
      extractionEnqueued: report.extraction.reduce((n, s) => n + s.enqueued, 0),
      matchReviewsEnqueued: report.advisor.matchReviewsEnqueued,
      weeklyReviewsEnqueued: report.advisor.weeklyReviewsEnqueued,
      developmentCycleEnqueued: report.advisor.developmentCycleEnqueued,
    },
  });

  return report;
}