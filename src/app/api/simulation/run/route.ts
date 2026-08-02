import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import { rateLimit } from "@/lib/rate-limit";
import { safeErrorResponse } from "@/lib/security/errors";
import type { SeasonSimulationRequest } from "@/lib/simulation/simulation-types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireActorContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit("simulation:run", 3, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
  }

  let body: SeasonSimulationRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.scope) {
    return NextResponse.json(
      { error: "scope is required" },
      { status: 400 },
    );
  }

  if (!body.includeLeague && !body.includeEvents) {
    return NextResponse.json(
      { error: "At least one of includeLeague or includeEvents must be true" },
      { status: 400 },
    );
  }

  if (!body.policyMode) {
    body.policyMode = "default_only";
  }

  if (body.leagueSeasonId) {
    const owned = await db.leagueSeason.findFirst({
      where: { id: body.leagueSeasonId, ...ctx.orgFilter.filter },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ error: "League season not found or access denied." }, { status: 404 });
    }
  }

  if (body.roundIds && body.roundIds.length > 0) {
    const ownedRounds = await db.matchRound.findMany({
      where: { id: { in: body.roundIds }, ...ctx.orgFilter.filter },
      select: { id: true },
    });
    const ownedIds = new Set(ownedRounds.map((r) => r.id));
    const unauthorised = body.roundIds.filter((id) => !ownedIds.has(id));
    if (unauthorised.length > 0) {
      return NextResponse.json({ error: "One or more round IDs not found or access denied." }, { status: 404 });
    }
  }

  if (body.eventIds && body.eventIds.length > 0) {
    const ownedEvents = await db.event.findMany({
      where: { id: { in: body.eventIds }, ...ctx.orgFilter.filter },
      select: { id: true },
    });
    const ownedIds = new Set(ownedEvents.map((e) => e.id));
    const unauthorised = body.eventIds.filter((id) => !ownedIds.has(id));
    if (unauthorised.length > 0) {
      return NextResponse.json({ error: "One or more event IDs not found or access denied." }, { status: 404 });
    }
  }

  try {
    const { runSeasonSimulation } = await import("@/lib/simulation/simulation-service");
    const result = await runSeasonSimulation(body);
    return NextResponse.json(result);
  } catch (error) {
    const { error: message } = safeErrorResponse(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}