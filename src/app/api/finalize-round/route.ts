import { NextResponse } from "next/server";
import { finalizeMatchRound } from "@/lib/selection/finalize-match-round";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { matchRoundId, overrideReason } = (body ?? {}) as Record<string, unknown>;

  if (!matchRoundId || typeof matchRoundId !== "string") {
    return NextResponse.json(
      { error: "matchRoundId is required." },
      { status: 400 },
    );
  }

  try {
    const result = await finalizeMatchRound(
      matchRoundId,
      typeof overrideReason === "string" && overrideReason.trim().length > 0
        ? overrideReason
        : undefined,
    );

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Finalization failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}