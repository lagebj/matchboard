import { NextResponse } from "next/server";
import { finalizeMatchRound } from "@/lib/selection/finalize-match-round";
import { rateLimit } from "@/lib/rate-limit";
import { requireCoachAccess } from "@/lib/auth";
import type { OverrideReasonCategory } from "@/lib/selection/types";
import { OVERRIDE_REASON_CATEGORIES } from "@/lib/selection/types";

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

  const { matchRoundId, overrideReasonCategory, overrideReasonDetail } = (body ?? {}) as Record<string, unknown>;

  if (!matchRoundId || typeof matchRoundId !== "string") {
    return NextResponse.json(
      { error: "matchRoundId is required." },
      { status: 400 },
    );
  }

  const category = typeof overrideReasonCategory === "string" && OVERRIDE_REASON_CATEGORIES.includes(overrideReasonCategory as OverrideReasonCategory)
    ? overrideReasonCategory as OverrideReasonCategory
    : undefined;
  const detail = typeof overrideReasonDetail === "string" && overrideReasonDetail.trim()
    ? overrideReasonDetail.trim()
    : undefined;

  try {
    const result = await finalizeMatchRound(matchRoundId, category, detail);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Finalisation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}