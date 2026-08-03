import { NextResponse } from "next/server";
import { requireActorContext, requireMutationRole } from "@/lib/auth/actor-context";
import { excludeOpponentSportingEvidence } from "@/lib/opponents/sporting-level-recording";

export async function POST(request: Request) {
  try {
    const ctx = await requireActorContext();
    requireMutationRole(ctx);

    const body = await request.json();
    const { evidenceId, reason } = body;

    if (!evidenceId || !reason || typeof reason !== "string") {
      return NextResponse.json({ error: "evidenceId and reason are required" }, { status: 400 });
    }

    const result = await excludeOpponentSportingEvidence(evidenceId, reason, ctx.orgFilter);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Access denied") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}