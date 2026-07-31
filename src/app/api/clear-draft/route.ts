import { clearAllDraftSelections, clearRoundDraftSelection, clearMatchDraftSelection } from "@/lib/selection/clear-draft-selection";
import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";
import { resolveOrgFilterForUser } from "@/lib/tenancy/resolve-org-filter";
import { rateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { clearDraftSchema } from "@/lib/security/validation";
import { safeErrorResponse } from "@/lib/security/errors";

export async function POST(request: Request) {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? '');
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
      const leagueSeason = await db.leagueSeason.findUnique({ where: { id: data.leagueSeasonId }, select: { organisationId: true } });
      if (!leagueSeason) return NextResponse.json({ error: "League season not found" }, { status: 404 });
      if (orgFilter.type === "org" && leagueSeason.organisationId !== orgFilter.organisationId) return NextResponse.json({ error: "League season not found or access denied." }, { status: 404 });
      const result = await clearAllDraftSelections(data.leagueSeasonId);
      return NextResponse.json({ level: "all", ...result });
    }
    if (data.level === "round") {
      const matchRound = await db.matchRound.findUnique({ where: { id: data.matchRoundId }, select: { organisationId: true } });
      if (!matchRound) return NextResponse.json({ error: "Match round not found" }, { status: 404 });
      if (orgFilter.type === "org" && matchRound.organisationId !== orgFilter.organisationId) return NextResponse.json({ error: "Match round not found or access denied." }, { status: 404 });
      const result = await clearRoundDraftSelection(data.matchRoundId);
      return NextResponse.json({ level: "round", ...result });
    }
    if (data.level === "match") {
      const match = await db.match.findUnique({ where: { id: data.matchId }, select: { team: { select: { organisationId: true } } } });
      if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
      if (orgFilter.type === "org" && match.team.organisationId !== orgFilter.organisationId) return NextResponse.json({ error: "Match not found or access denied." }, { status: 404 });
      const result = await clearMatchDraftSelection(data.matchId);
      return NextResponse.json({ level: "match", ...result });
    }
    return NextResponse.json({ error: "Invalid level. Use 'all', 'round', or 'match'." }, { status: 400 });
  } catch (error) {
    const { error: message, statusCode } = safeErrorResponse(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}