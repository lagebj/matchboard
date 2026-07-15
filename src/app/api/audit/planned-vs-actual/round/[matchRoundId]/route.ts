import { NextResponse } from "next/server";
import { requireCoachAccess } from "@/lib/auth";
import { getPlannedVsActualForRound } from "@/lib/audit/planned-vs-actual";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ matchRoundId: string }> },
) {
  await requireCoachAccess();

  const { matchRoundId } = await params;
  const data = await getPlannedVsActualForRound(matchRoundId);

  return NextResponse.json(data);
}