import { NextResponse } from "next/server";
import { finalizeMatchRound } from "@/lib/selection/finalize-match-round";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { requireActorContext } from "@/lib/auth/actor-context";
import { finalizeRoundSchema } from "@/lib/security/validation";
import { safeErrorResponse } from "@/lib/security/errors";
import type { OverrideReasonCategory } from "@/lib/selection/types";

export async function POST(request: Request) {
  const ctx = await requireActorContext();
  const { allowed } = rateLimit("finalize-round", 5, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many finalization requests. Please wait a moment and try again." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = finalizeRoundSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }

  const { matchRoundId, overrideReasonCategory, overrideReasonDetail } = parsed.data;

  const matchRound = await db.matchRound.findUnique({ where: { id: matchRoundId }, select: { organisationId: true } });
  if (!matchRound) {
    return NextResponse.json({ error: "Match round not found" }, { status: 404 });
  }
  if (matchRound.organisationId !== ctx.organisationId) {
    return NextResponse.json({ error: "Match round not found or access denied." }, { status: 404 });
  }

  try {
    const result = await finalizeMatchRound(
      matchRoundId,
      overrideReasonCategory as OverrideReasonCategory | undefined,
      overrideReasonDetail,
    );
    return NextResponse.json(result);
  } catch (error) {
    const { error: message, statusCode } = safeErrorResponse(error);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}