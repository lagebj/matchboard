import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";
import { resolveOrgFilterForUser } from "@/lib/tenancy/resolve-org-filter";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? '');
  const rl = rateLimit("season:path-detail", 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
  }
  const { searchParams } = request.nextUrl;
  const fromTeamId = searchParams.get("fromTeamId");
  const toTeamId = searchParams.get("toTeamId");
  const role = searchParams.get("role");
  const leagueSeasonId = searchParams.get("leagueSeasonId");
  const includeDrafts = searchParams.get("includeDrafts") === "true";

  if (!fromTeamId || !toTeamId || !role || !leagueSeasonId) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  const validRoles: string[] = ["CORE", "SUPPORT", "DEVELOPMENT", "BACKFILL"];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const where = {
    fromTeamId,
    toTeamId,
    role: role as "CORE" | "SUPPORT" | "DEVELOPMENT" | "BACKFILL",
    matchRound: { leagueSeasonId },
    ...(includeDrafts ? {} : { isDraft: false }),
    ...(orgFilter.type === "org" ? orgFilter.filter : {}),
  };

  const movements = await db.movementLedger.findMany({
    where,
    include: {
      player: { select: { firstName: true, lastName: true } },
      matchRound: { select: { name: true } },
      match: { select: { startsAt: true } },
    },
    orderBy: { match: { startsAt: "desc" } },
  });

  const result = movements.map((m) => ({
    playerName: `${m.player.firstName}${m.player.lastName ? ` ${m.player.lastName}` : ""}`,
    roundName: m.matchRound.name,
    date: m.match.startsAt.toISOString().slice(0, 10),
    isDraft: m.isDraft,
  }));

  return NextResponse.json(result);
}