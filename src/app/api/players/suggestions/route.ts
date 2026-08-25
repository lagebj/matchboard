import { NextResponse } from "next/server";
import { requireActorContext, requireMutationRole } from "@/lib/auth/actor-context";
import { evaluatePlayerAttributeSuggestions, decideSuggestion, getPendingSuggestions, getSuggestionHistory } from "@/lib/player-development/suggestions";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

export async function GET(request: Request) {
  try {
    const ctx = await requireActorContext();
    setTenantOrganisationId(ctx.organisationId);

    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get("playerId");

    if (!playerId) {
      return NextResponse.json({ error: "playerId is required" }, { status: 400 });
    }

    const view = searchParams.get("view") ?? "pending";

    if (view === "pending") {
      const suggestions = await getPendingSuggestions(playerId, ctx.orgFilter);
      return NextResponse.json({ suggestions });
    } else if (view === "history") {
      const history = await getSuggestionHistory(playerId, ctx.orgFilter);
      return NextResponse.json({ suggestions: history });
    } else if (view === "evaluate") {
      const suggestions = await evaluatePlayerAttributeSuggestions(playerId, ctx.orgFilter);
      return NextResponse.json({ suggestions });
    }

    return NextResponse.json({ error: "Invalid view parameter. Use 'pending', 'history', or 'evaluate'" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireActorContext();
    setTenantOrganisationId(ctx.organisationId);
    requireMutationRole(ctx);

    const body = await request.json();
    const { suggestionId, decision, adjustedValue } = body;

    if (!suggestionId || !decision) {
      return NextResponse.json({ error: "suggestionId and decision are required" }, { status: 400 });
    }

    if (!["ACCEPT", "ADJUST", "REJECT"].includes(decision)) {
      return NextResponse.json({ error: "decision must be ACCEPT, ADJUST, or REJECT" }, { status: 400 });
    }

    if (decision === "ADJUST" && (adjustedValue === undefined || adjustedValue < 1 || adjustedValue > 10)) {
      return NextResponse.json({ error: "adjustedValue must be between 1 and 10 for ADJUST decision" }, { status: 400 });
    }

    const result = await decideSuggestion(suggestionId, decision, adjustedValue);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}