import { NextResponse } from "next/server";
import { requireActorContext } from "@/lib/auth/actor-context";
import { getPlannedVsActualForMatch } from "@/lib/audit/planned-vs-actual";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const ctx = await requireActorContext();
  const { matchId } = await params;

  const data = await getPlannedVsActualForMatch(matchId, ctx.orgFilter);

  if (!data) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}