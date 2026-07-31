import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";
import { resolveOrgFilterForUser } from "@/lib/tenancy/resolve-org-filter";

export const runtime = "nodejs";

export async function GET() {
  let coach;
  try {
    coach = await requireCoachAccess();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgFilter = await resolveOrgFilterForUser(coach.id ?? "");

  const where = orgFilter.type === "org" ? orgFilter.filter : {};

  const leagueSeasons = await db.leagueSeason.findMany({
    where,
    include: { season: { select: { year: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const options = leagueSeasons.map((ls) => ({
    id: ls.id,
    name: ls.name,
    seasonYear: ls.season.year,
    part: ls.part,
  }));

  return NextResponse.json(options);
}