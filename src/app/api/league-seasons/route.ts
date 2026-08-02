import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";

export const runtime = "nodejs";

export async function GET() {
  let ctx;
  try {
    ctx = await requireActorContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const where = ctx.orgFilter.filter;

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