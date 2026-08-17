import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import { getPlannedVsActualForRound } from "@/lib/audit/planned-vs-actual";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ matchRoundId: string }> },
) {
  const ctx = await requireActorContext();

  const { matchRoundId } = await params;

  const matchRound = await db.matchRound.findFirst({
    where: { id: matchRoundId },
    select: { organisationId: true },
  });
  if (!matchRound) {
    return NextResponse.json({ error: "Match round not found" }, { status: 404 });
  }
  if (matchRound.organisationId !== ctx.organisationId) {
    return NextResponse.json({ error: "Match round not found or access denied." }, { status: 404 });
  }

  const data = await getPlannedVsActualForRound(matchRoundId);
  return NextResponse.json(data);
}