import { NextResponse } from "next/server";
import { isTestAgentAuthEnabled } from "@/lib/env";
import { db } from "@/lib/db";
import { requirePageActorContext, requireMutationRole, requireTeamGroupAccess } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { createMatchCore } from "@/app/(app)/matches/actions";
import { refreshDraftRound } from "@/lib/selection/refresh-draft-selection";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Test-only fast-path fixture setup: create + generate a League match in DRAFT state
 * (no planning-baseline capture), for e2e specs that need a DRAFT round to test
 * regeneration, clearing, and other draft-only operations. Unlike seed-finalized-match,
 * this does NOT call ensureMatchPlanningBaselineCaptured, so the round stays in DRAFT
 * state with its planning boundary still open.
 *
 * Double-gated, matching seed-finalized-match's pattern:
 * 1. isTestAgentAuthEnabled() -- requires MATCHBOARD_ENV=test AND an explicit opt-in secret.
 * 2. A real authenticated session is still required (requirePageActorContext() +
 *    requireMutationRole() + requireTeamGroupAccess()) -- this is not an auth bypass.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isTestAgentAuthEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as Record<string, unknown>).teamName !== "string" ||
    typeof (body as Record<string, unknown>).opponentName !== "string" ||
    typeof (body as Record<string, unknown>).startsAt !== "string"
  ) {
    return NextResponse.json(
      { error: "Invalid request body. Required: teamName (string), opponentName (string), startsAt (ISO date string)" },
      { status: 400 },
    );
  }

  const { teamName, opponentName, startsAt: startsAtRaw } = body as { teamName: string; opponentName: string; startsAt: string };

  const startsAt = new Date(startsAtRaw);
  if (isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: "startsAt must be a valid ISO date string" }, { status: 400 });
  }

  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

  const team = await db.team.findFirst({
    where: { name: teamName, archivedAt: null, organisationId: ctx.organisationId },
    select: { id: true },
  });
  if (!team) {
    return NextResponse.json({ error: `Team not found: ${teamName}` }, { status: 404 });
  }
  await requireTeamGroupAccess(ctx, team.id);

  try {
    const { matchId, matchRoundId } = await createMatchCore(ctx, {
      teamId: team.id,
      opponentText: opponentName,
      startsAt,
      homeAway: "HOME",
      matchType: "FRIENDLY",
      gameFormat: "ELEVEN_A_SIDE",
    });

    const regenerateResult = await refreshDraftRound(matchRoundId);
    if (regenerateResult.preservedManualDraft) {
      return NextResponse.json({ error: "Round has manual edits that were preserved (unexpected for a freshly created round)." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, matchId, opponentName, matchRoundId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not seed the draft match.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}