import { NextResponse } from "next/server";
import { isTestAgentAuthEnabled } from "@/lib/env";
import { db } from "@/lib/db";
import { requirePageActorContext, requireMutationRole, requireTeamGroupAccess } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { createMatchCore } from "@/app/(app)/matches/actions";
import { refreshDraftRound } from "@/lib/selection/refresh-draft-selection";
import { finalizeSingleMatch } from "@/lib/selection/finalize-single-match";

export const dynamic = "force-dynamic";

/**
 * Test-only fast-path fixture setup: create + generate + finalize a League match in one call,
 * for e2e specs that need a finalized match to exist so they can test something else entirely
 * (live reporting, following) -- not the create/generate/finalize UI flow itself, which is
 * already covered by round-mutation.spec.ts/smoke.spec.ts. Driving that whole pipeline through
 * real UI clicks for every such spec was measured to cost 1-3 minutes of setup per test; this
 * does the same real domain operations (createMatchCore/refreshDraftRound/finalizeSingleMatch --
 * the exact same functions the real UI actions call, never a reimplementation) in a few seconds.
 *
 * Double-gated, matching /api/auth/test-agent's existing pattern:
 * 1. isTestAgentAuthEnabled() -- requires MATCHBOARD_ENV=test AND an explicit opt-in secret to
 *    even be present in the environment. Refuses (404, not just 403 -- do not reveal this route
 *    exists) outside that environment, including production, unconditionally.
 * 2. A real authenticated session is still required (requirePageActorContext() +
 *    requireMutationRole() + requireTeamGroupAccess()) -- this is not an auth bypass, it only
 *    fast-forwards through UI steps for a caller who is already a genuine, already-authenticated
 *    coach (Playwright's real Auth.js session, established by e2e/auth.setup.ts).
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
      // Same defaults src/components/matches/match-create-form.tsx's fields default to -- this
      // endpoint exists to skip UI *navigation*, not to change what gets created.
      homeAway: "HOME",
      matchType: "FRIENDLY",
      gameFormat: "ELEVEN_A_SIDE",
    });

    const regenerateResult = await refreshDraftRound(matchRoundId);
    if (regenerateResult.preservedManualDraft) {
      return NextResponse.json({ error: "Round has manual edits that were preserved (unexpected for a freshly created round)." }, { status: 500 });
    }

    const finalizeResult = await finalizeSingleMatch(matchId);
    if (!finalizeResult.success) {
      return NextResponse.json({ error: `Finalisation failed: ${finalizeResult.warnings.join(", ")}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, matchId, opponentName, matchRoundId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not seed the finalized match.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
