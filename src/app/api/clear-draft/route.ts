import { clearAllDraftSelections, clearRoundDraftSelection, clearMatchDraftSelection } from "@/lib/selection/clear-draft-selection";
import { rateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { allowed } = rateLimit("clear-draft", 5, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
  }

  let body: { level: string; planningPeriodId?: string; matchRoundId?: string; matchId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { level } = body;

  try {
    if (level === "all") {
      if (!body.planningPeriodId || typeof body.planningPeriodId !== "string") {
        return NextResponse.json({ error: "planningPeriodId is required for clear all" }, { status: 400 });
      }
      const result = await clearAllDraftSelections(body.planningPeriodId);
      return NextResponse.json({ level: "all", ...result });
    }

    if (level === "round") {
      if (!body.matchRoundId || typeof body.matchRoundId !== "string") {
        return NextResponse.json({ error: "matchRoundId is required for clear round" }, { status: 400 });
      }
      const result = await clearRoundDraftSelection(body.matchRoundId);
      return NextResponse.json({ level: "round", ...result });
    }

    if (level === "match") {
      if (!body.matchId || typeof body.matchId !== "string") {
        return NextResponse.json({ error: "matchId is required for clear match" }, { status: 400 });
      }
      const result = await clearMatchDraftSelection(body.matchId);
      return NextResponse.json({ level: "match", ...result });
    }

    return NextResponse.json({ error: "Invalid level. Use 'all', 'round', or 'match'." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Clear draft failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}