import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";
import { resolveOrgFilterForUser } from "@/lib/tenancy/resolve-org-filter";
import { getPlannedVsActualForRound } from "@/lib/audit/planned-vs-actual";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ matchRoundId: string }> },
) {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? '');

  const { matchRoundId } = await params;

  const matchRound = await db.matchRound.findUnique({
    where: { id: matchRoundId },
    select: { organisationId: true },
  });
  if (!matchRound) {
    return NextResponse.json({ error: "Match round not found" }, { status: 404 });
  }
  if (orgFilter.type === "org" && matchRound.organisationId !== orgFilter.organisationId) {
    return NextResponse.json({ error: "Match round not found or access denied." }, { status: 404 });
  }

  const data = await getPlannedVsActualForRound(matchRoundId);
  return NextResponse.json(data);
}