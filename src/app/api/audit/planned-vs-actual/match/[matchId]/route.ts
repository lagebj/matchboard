import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";
import { resolveOrgFilterForUser } from "@/lib/tenancy/resolve-org-filter";
import { getPlannedVsActualForMatch } from "@/lib/audit/planned-vs-actual";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? '');

  const { matchId } = await params;

  const match = await db.match.findUnique({
    where: { id: matchId },
    select: { team: { select: { organisationId: true } } },
  });
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }
  if (orgFilter.type === "org" && match.team.organisationId !== orgFilter.organisationId) {
    return NextResponse.json({ error: "Match not found or access denied." }, { status: 404 });
  }

  const data = await getPlannedVsActualForMatch(matchId);

  if (!data) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}