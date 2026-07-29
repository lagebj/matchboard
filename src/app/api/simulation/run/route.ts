import { NextRequest, NextResponse } from "next/server";
import { requireCoachAccess } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { safeErrorResponse } from "@/lib/security/errors";
import type { SeasonSimulationRequest } from "@/lib/simulation/simulation-types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await requireCoachAccess();
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

  try {
    const { runSeasonSimulation } = await import("@/lib/simulation/simulation-service");
    const result = await runSeasonSimulation(body);
    return NextResponse.json(result);
  } catch (error) {
    const { error: message } = safeErrorResponse(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}