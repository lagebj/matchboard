import { NextResponse } from "next/server";
import { requireActorContext, requireMutationRole } from "@/lib/auth/actor-context";
import { createDevelopmentObservation, deleteDevelopmentObservation } from "@/lib/player-development/observations";

export async function POST(request: Request) {
  try {
    const ctx = await requireActorContext();
    requireMutationRole(ctx);

    const body = await request.json();
    const { playerId, matchId, kind, attributeKey, positionId, direction, observableNote, sourceType } = body;

    if (!playerId || !matchId || !kind || !direction) {
      return NextResponse.json({ error: "playerId, matchId, kind, and direction are required" }, { status: 400 });
    }

    const result = await createDevelopmentObservation({
      playerId,
      matchId,
      kind,
      attributeKey,
      positionId,
      direction,
      observableNote,
      sourceType,
    });

    return NextResponse.json({ id: result.id }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Access denied" || error.message === "Organisation access required") {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await requireActorContext();
    requireMutationRole(ctx);

    const { searchParams } = new URL(request.url);
    const observationId = searchParams.get("observationId");

    if (!observationId) {
      return NextResponse.json({ error: "observationId is required" }, { status: 400 });
    }

    const result = await deleteDevelopmentObservation(observationId);

    return NextResponse.json({ success: result.success });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Observation not found or access denied") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}