import { NextRequest, NextResponse } from "next/server";
import { requireActorContext } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { getAssessmentHistory } from "@/lib/evidence/assessment-change";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> },
) {
  const { playerId } = await params;

  let ctx;
  try {
    ctx = await requireActorContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  setTenantOrganisationId(ctx.organisationId);

  const changes = await getAssessmentHistory(playerId, ctx.orgFilter);

  return NextResponse.json({
    changes: changes.map((c) => ({
      id: c.id,
      targetType: c.targetType,
      attributeKey: c.attributeKey,
      targetDescription: c.targetDescription,
      beforeValue: c.beforeValue !== null ? Number(c.beforeValue) : null,
      afterValue: c.afterValue !== null ? Number(c.afterValue) : null,
      source: c.source,
      reason: c.reason,
      confidence: c.confidence !== null ? Number(c.confidence) : null,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}