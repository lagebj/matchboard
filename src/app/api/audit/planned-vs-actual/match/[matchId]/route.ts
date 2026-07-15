import { NextResponse } from "next/server";
import { requireCoachAccess } from "@/lib/auth";
import { getPlannedVsActualForMatch } from "@/lib/audit/planned-vs-actual";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  await requireCoachAccess();

  const { matchId } = await params;
  const data = await getPlannedVsActualForMatch(matchId);

  if (!data) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}