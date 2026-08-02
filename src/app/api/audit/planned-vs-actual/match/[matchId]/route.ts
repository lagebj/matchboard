import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import { getPlannedVsActualForMatch } from "@/lib/audit/planned-vs-actual";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const ctx = await requireActorContext();

  const { matchId } = await params;

  const match = await db.match.findUnique({
    where: { id: matchId },
    select: { team: { select: { organisationId: true } } },
  });
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }
  if (match.team.organisationId !== ctx.organisationId) {
    return NextResponse.json({ error: "Match not found or access denied." }, { status: 404 });
  }

  const data = await getPlannedVsActualForMatch(matchId);

  if (!data) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}