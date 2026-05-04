import { addPlayerToDraftMatch, removePlayerFromDraftMatch, changeDraftPlayerRole, replaceDraftMatchPlayer } from "@/lib/selection/manual-draft-edit";
import { SelectionRole } from "@/generated/prisma/client";
import { rateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

const VALID_ROLES = new Set(Object.values(SelectionRole));

export async function POST(request: Request) {
  const { allowed } = rateLimit("draft-selection", 10, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
  }

  let body: {
    action: string;
    matchId?: string;
    playerId?: string;
    role?: string;
    incomingPlayerId?: string;
    overrideReason?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { action } = body;

  try {
    if (action === "add") {
      if (!body.matchId || !body.playerId || !body.role) {
        return NextResponse.json({ error: "matchId, playerId, and role are required" }, { status: 400 });
      }
      if (!VALID_ROLES.has(body.role as SelectionRole)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      const result = await addPlayerToDraftMatch(
        body.matchId,
        body.playerId,
        body.role as SelectionRole,
        body.overrideReason,
      );
      return NextResponse.json(result, { status: result.success ? 200 : 422 });
    }

    if (action === "remove") {
      if (!body.matchId || !body.playerId) {
        return NextResponse.json({ error: "matchId and playerId are required" }, { status: 400 });
      }
      const result = await removePlayerFromDraftMatch(body.matchId, body.playerId);
      return NextResponse.json(result, { status: result.success ? 200 : 422 });
    }

    if (action === "changeRole") {
      if (!body.matchId || !body.playerId || !body.role) {
        return NextResponse.json({ error: "matchId, playerId, and role are required" }, { status: 400 });
      }
      if (!VALID_ROLES.has(body.role as SelectionRole)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      const result = await changeDraftPlayerRole(
        body.matchId,
        body.playerId,
        body.role as SelectionRole,
        body.overrideReason,
      );
      return NextResponse.json(result, { status: result.success ? 200 : 422 });
    }

    if (action === "replace") {
      if (!body.matchId || !body.playerId || !body.incomingPlayerId || !body.role) {
        return NextResponse.json({ error: "matchId, playerId (outgoing), incomingPlayerId, and role are required" }, { status: 400 });
      }
      if (!VALID_ROLES.has(body.role as SelectionRole)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      const result = await replaceDraftMatchPlayer(
        body.matchId,
        body.playerId,
        body.incomingPlayerId,
        body.role as SelectionRole,
        body.overrideReason,
      );
      return NextResponse.json(result, { status: result.success ? 200 : 422 });
    }

    return NextResponse.json({ error: "Invalid action. Use 'add', 'remove', 'changeRole', or 'replace'." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Draft edit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}