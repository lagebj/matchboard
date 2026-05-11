import { NextRequest, NextResponse } from "next/server";
import { getSeasonPlayerRoundMatrix } from "@/lib/selection/get-season-overview";
import { requireCoachAccess } from "@/lib/auth";

export async function GET(request: NextRequest) {
  await requireCoachAccess();
  const { searchParams } = request.nextUrl;
  const planningPeriodId = searchParams.get("planningPeriodId");
  const includeDrafts = searchParams.get("includeDrafts") === "true";

  if (!planningPeriodId) {
    return NextResponse.json({ error: "planningPeriodId required" }, { status: 400 });
  }

  const matrix = await getSeasonPlayerRoundMatrix(planningPeriodId, includeDrafts);
  return NextResponse.json(matrix);
}