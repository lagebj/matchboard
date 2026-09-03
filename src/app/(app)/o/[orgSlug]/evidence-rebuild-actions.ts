"use server";

import { requireActorContext, canAdmin } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { replayPostMatchLearningHistory, type PostMatchLearningReplaySummary } from "@/lib/evidence/post-match-learning-replay";

// Evidence-Informed Match Planning programme addendum: "Rebuild historical evidence" transient
// admin tool (AGENTS.md section of the same name). Mirrors the "Populate opponent levels" tool's
// operational pattern (opponent-population-actions.ts) exactly -- org-admin-only, org-scoped,
// safe to rerun. The domain logic (replayPostMatchLearningHistory) already existed and already
// covers every completed League and Event match through the one shared runPostMatchLearning()
// pipeline; this file is only the authorization/tenancy wrapper the UI needs.

export async function rebuildHistoricalEvidenceAction(orgSlug: string): Promise<PostMatchLearningReplaySummary> {
  const ctx = await requireActorContext(orgSlug);
  if (!canAdmin(ctx)) {
    throw new Error("Admin access required");
  }
  setTenantOrganisationId(ctx.organisationId);

  return replayPostMatchLearningHistory(ctx.organisationId);
}
