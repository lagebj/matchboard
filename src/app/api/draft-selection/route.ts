import { addPlayerToDraftMatch, removePlayerFromDraftMatch, changeDraftPlayerRole, replaceDraftMatchPlayer } from "@/lib/selection/manual-draft-edit";
import { SelectionRole } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";
import { resolveOrgFilterForUser } from "@/lib/tenancy/resolve-org-filter";
import { rateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { draftSelectionSchema } from "@/lib/security/validation";
import { safeErrorResponse } from "@/lib/security/errors";
import type { OverrideReasonCategory } from "@/lib/selection/types";

export async function POST(request: Request) {
  const coach = await requireCoachAccess();
  const orgFilter = await resolveOrgFilterForUser(coach.id ?? '');
  const { allowed } = rateLimit("draft-selection", 10, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = draftSelectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }

  const data = parsed.data;

  const match = await db.match.findUnique({ where: { id: data.matchId }, select: { team: { select: { organisationId: true } } } });
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }
  if (orgFilter.type === "org" && match.team.organisationId !== orgFilter.organisationId) {
    return NextResponse.json({ error: "Match not found or access denied." }, { status: 404 });
  }

  try {
    if (data.action === "add") {
      const result = await addPlayerToDraftMatch(
        data.matchId,
        data.playerId,
        data.role as SelectionRole,
        data.overrideReasonCategory as OverrideReasonCategory | undefined,
        data.overrideReasonDetail,
      );
      return NextResponse.json(result, { status: result.success ? 200 : 422 });
    }

    if (data.action === "remove") {
      const result = await removePlayerFromDraftMatch(data.matchId, data.playerId);
      return NextResponse.json(result, { status: result.success ? 200 : 422 });
    }

    if (data.action === "changeRole") {
      const result = await changeDraftPlayerRole(
        data.matchId,
        data.playerId,
        data.role as SelectionRole,
        data.overrideReasonCategory as OverrideReasonCategory | undefined,
        data.overrideReasonDetail,
      );
      return NextResponse.json(result, { status: result.success ? 200 : 422 });
    }

    if (data.action === "replace") {
      const result = await replaceDraftMatchPlayer(
        data.matchId,
        data.playerId,
        data.incomingPlayerId,
        data.role as SelectionRole,
        data.overrideReasonCategory as OverrideReasonCategory | undefined,
        data.overrideReasonDetail,
      );
      return NextResponse.json(result, { status: result.success ? 200 : 422 });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error) {
    const { error: message, statusCode } = safeErrorResponse(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}