import { NextResponse } from "next/server";
import { finalizeMatchRound } from "@/lib/selection/finalize-match-round";
import { rateLimit } from "@/lib/rate-limit";
import { requireCoachAccess } from "@/lib/auth";
import { finalizeRoundSchema } from "@/lib/security/validation";
import { safeErrorResponse } from "@/lib/security/errors";
import type { OverrideReasonCategory } from "@/lib/selection/types";

export async function POST(request: Request) {
  await requireCoachAccess();
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