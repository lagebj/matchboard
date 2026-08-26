"use server";

import { requireActorContext, canAdmin } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { applyOpponentEvidenceHistory, dryRunOpponentEvidence } from "@/lib/evidence/opponent-replay";
import type { ApplyResult } from "@/lib/evidence/opponent-replay";

export async function dryRunOpponentEvidenceAction(
  orgSlug: string,
  options?: { gameFormat?: string; from?: string; to?: string },
) {
  const ctx = await requireActorContext(orgSlug);
  if (!canAdmin(ctx)) {
    throw new Error("Admin access required");
  }
  setTenantOrganisationId(ctx.organisationId);

  const parsedOptions = options ? {
    ...options,
    from: options.from ? new Date(options.from) : undefined,
    to: options.to ? new Date(options.to) : undefined,
  } : undefined;

  return dryRunOpponentEvidence(ctx.organisationId, parsedOptions);
}

export async function applyOpponentEvidenceAction(
  orgSlug: string,
  options?: { gameFormat?: string; from?: string; to?: string },
): Promise<ApplyResult> {
  const ctx = await requireActorContext(orgSlug);
  if (!canAdmin(ctx)) {
    throw new Error("Admin access required");
  }
  setTenantOrganisationId(ctx.organisationId);

  const parsedOptions = options ? {
    ...options,
    from: options.from ? new Date(options.from) : undefined,
    to: options.to ? new Date(options.to) : undefined,
  } : undefined;

  return applyOpponentEvidenceHistory(ctx.organisationId, parsedOptions);
}