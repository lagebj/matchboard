import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActorContext, requireMutationRole } from "@/lib/auth/actor-context";
import { rateLimit } from "@/lib/rate-limit";
import { safeErrorResponse } from "@/lib/security/errors";
import { applySimulationAsDrafts, computeSimulationInputHash, isInputStale } from "@/lib/simulation/apply-simulation";

export const runtime = "nodejs";

export type ApplyRequest = {
  leagueSeasonId: string;
  roundIds?: string[];
  previousInputHash?: {
    leagueSeasonId: string;
    roundIds: string[];
    playerCount: number;
    matchCount: number;
    availabilityCount: number;
    rotationPathCount: number;
    computedAt: string;
  };
};

export async function POST(request: NextRequest) {
  let ctx;
  try {
    ctx = await requireActorContext();
    requireMutationRole(ctx);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit("simulation:apply", 2, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
  }

  let body: ApplyRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.leagueSeasonId) {
    return NextResponse.json({ error: "leagueSeasonId is required" }, { status: 400 });
  }

  const owned = await db.leagueSeason.findFirst({
    where: { id: body.leagueSeasonId, ...ctx.orgFilter.filter },
    select: { id: true },
  });
  if (!owned) {
    return NextResponse.json({ error: "League season not found or access denied." }, { status: 404 });
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

  try {
    if (body.previousInputHash) {
      const currentHash = await computeSimulationInputHash(body.leagueSeasonId, body.roundIds);
      if (isInputStale(currentHash, body.previousInputHash)) {
        return NextResponse.json(
          {
            error: "Input data has changed since the simulation was run. Please re-run the simulation before applying.",
            staleInput: true,
            currentHash,
          },
          { status: 409 },
        );
      }
    }

    const result = await applySimulationAsDrafts(body.leagueSeasonId, body.roundIds);
    return NextResponse.json(result);
  } catch (error) {
    const { error: message } = safeErrorResponse(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}