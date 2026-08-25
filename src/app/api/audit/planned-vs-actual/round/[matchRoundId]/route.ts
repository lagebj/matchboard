import { NextResponse } from "next/server";
import { requireActorContext } from "@/lib/auth/actor-context";
import { getPlannedVsActualForRound } from "@/lib/audit/planned-vs-actual";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ matchRoundId: string }> },
) {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);
  const { matchRoundId } = await params;

  const data = await getPlannedVsActualForRound(matchRoundId, ctx.orgFilter);
  return NextResponse.json(data);
}