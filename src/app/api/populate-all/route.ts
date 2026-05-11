import { populateAllDrafts } from "@/lib/selection/populate-all-drafts";
import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  await requireCoachAccess();
  const { allowed } = rateLimit("populate-all", 3, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many populate-all requests. Please wait a moment and try again." },
      { status: 429 },
    );
  }

  let planningPeriodId: unknown;
  try {
    const body = await request.json();
    planningPeriodId = body.planningPeriodId;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!planningPeriodId || typeof planningPeriodId !== "string") {
    return NextResponse.json({ error: "planningPeriodId is required" }, { status: 400 });
  }

  const planningPeriod = await db.planningPeriod.findUnique({
    where: { id: planningPeriodId },
    select: { id: true, name: true },
  });

  if (!planningPeriod) {
    return NextResponse.json({ error: "Planning period not found" }, { status: 404 });
  }

  try {
    const result = await populateAllDrafts(planningPeriodId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Populate-all failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}