import { NextResponse } from "next/server";
import { isTestAgentAuthEnabled } from "@/lib/env";
import { requirePageActorContext, requireMutationRole, requireTeamGroupAccess } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { db } from "@/lib/db";
import { reopenMatchPlanningForReschedule } from "@/lib/selection/capture-planning-baseline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Test-only fast-path: reopen a match's planning boundary that was captured
 * (FINALIZED) by seed-finalized-match, reverting it back to DRAFT state so
 * round-mutation.spec.ts can test draft-only operations (regenerate, clear).
 *
 * This uses the same domain function (`reopenMatchPlanningForReschedule`) that
 * the normal match-edit/reschedule command uses — the only difference is the
 * test-only auth gate and the absence of an actual date change (the match's
 * startsAt remains unchanged in the future, which is fine since the real
 * reschedule command only calls this function when the date moves forward, but
 * the domain function itself just checks for live sessions and completed reports,
 * not the date — the test match has neither).
 *
 * Double-gated, matching seed-finalized-match's pattern:
 * 1. isTestAgentAuthEnabled() -- requires MATCHBOARD_ENV=test AND an explicit opt-in secret.
 * 2. A real authenticated session is still required.
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
    typeof (body as Record<string, unknown>).matchId !== "string"
  ) {
    return NextResponse.json(
      { error: "Invalid request body. Required: matchId (string)" },
      { status: 400 },
    );
  }

  const { matchId } = body as { matchId: string };

  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

  const match = await db.match.findUnique({
    where: { id: matchId, organisationId: ctx.organisationId },
    select: { id: true, teamId: true },
  });
  if (!match) {
    return NextResponse.json({ error: `Match not found: ${matchId}` }, { status: 404 });
  }
  await requireTeamGroupAccess(ctx, match.teamId);

  try {
    const result = await reopenMatchPlanningForReschedule(matchId);
    if (!result.reopened) {
      return NextResponse.json(
        { error: `Could not reopen match planning: ${"reason" in result ? result.reason : "unknown"}` },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true, matchId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not reopen match planning.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}