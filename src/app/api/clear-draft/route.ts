import { clearAllDraftSelections, clearRoundDraftSelection, clearMatchDraftSelection } from "@/lib/selection/clear-draft-selection";
import { requireCoachAccess } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { clearDraftSchema } from "@/lib/security/validation";
import { safeErrorResponse } from "@/lib/security/errors";

export async function POST(request: Request) {
  await requireCoachAccess();
  const { allowed } = rateLimit("clear-draft", 5, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = clearDraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }

  try {
    const data = parsed.data;
    if (data.level === "all") {
      const result = await clearAllDraftSelections(data.leagueSeasonId);
      return NextResponse.json({ level: "all", ...result });
    }
    if (data.level === "round") {
      const result = await clearRoundDraftSelection(data.matchRoundId);
      return NextResponse.json({ level: "round", ...result });
    }
    if (data.level === "match") {
      const result = await clearMatchDraftSelection(data.matchId);
      return NextResponse.json({ level: "match", ...result });
    }
    return NextResponse.json({ error: "Invalid level. Use 'all', 'round', or 'match'." }, { status: 400 });
  } catch (error) {
    const { error: message, statusCode } = safeErrorResponse(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}