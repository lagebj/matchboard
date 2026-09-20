import { NextResponse } from "next/server";
import { requireActorContext, requireOwnerRole } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { safeErrorResponse } from "@/lib/security/errors";
import { isAiProviderWireId } from "@/lib/ai/provider-registry";
import { isAiSecurityBoundaryConfigured, getAiSecurityEnrollmentUrl } from "@/lib/ai/config";
import { createPendingProviderConnection } from "@/lib/ai/provider-connections";
import { signEnrollmentToken } from "@/lib/ai/enrollment-token";

/**
 * POST /api/ai/connections/bootstrap (04_ORG_CONNECTION_FLOW.md).
 *
 * Owner-only. Creates a PENDING `AiProviderConnection` and returns a signed, 90-second enrollment
 * token the browser uses to submit the provider credential directly to matchboard-security — the
 * credential itself is never sent to this or any other Matchboard route.
 */
export async function POST(request: Request) {
  try {
    const ctx = await requireActorContext();
    setTenantOrganisationId(ctx.organisationId);
    requireOwnerRole(ctx);

    if (!isAiSecurityBoundaryConfigured()) {
      return NextResponse.json({ error: "AI Advisor is not configured on this deployment." }, { status: 503 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const provider = (body as { provider?: unknown } | null)?.provider;
    if (typeof provider !== "string" || !isAiProviderWireId(provider)) {
      return NextResponse.json({ error: "provider must be one of the supported AI provider IDs" }, { status: 400 });
    }

    const connection = await createPendingProviderConnection({
      organisationId: ctx.organisationId,
      provider,
      createdByUserId: ctx.userId,
    });

    const token = await signEnrollmentToken({ connectionId: connection.id, provider });

    return NextResponse.json({
      connectionId: connection.id,
      provider,
      enrollmentUrl: getAiSecurityEnrollmentUrl(),
      token,
    });
  } catch (error) {
    const { error: message, statusCode } = safeErrorResponse(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
