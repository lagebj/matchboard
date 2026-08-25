import { NextResponse } from "next/server";
import { requireActorContext, requireMutationRole } from "@/lib/auth/actor-context";
import { includeOpponentSportingEvidence } from "@/lib/opponents/sporting-level-recording";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

export async function POST(request: Request) {
  try {
    const ctx = await requireActorContext();
    setTenantOrganisationId(ctx.organisationId);
    requireMutationRole(ctx);

    const body = await request.json();
    const { evidenceId } = body;

    if (!evidenceId) {
      return NextResponse.json({ error: "evidenceId is required" }, { status: 400 });
    }

    const result = await includeOpponentSportingEvidence(evidenceId, ctx.orgFilter);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Access denied") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}