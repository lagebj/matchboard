import { NextResponse } from "next/server";
import { isTestAgentAuthEnabled } from "@/lib/env";
import { db } from "@/lib/db";
import { requirePageActorContext, requireMutationRole, requireTeamGroupAccess } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { createMatchCore } from "@/app/(app)/matches/actions";
import { refreshDraftRound } from "@/lib/selection/refresh-draft-selection";
import { createLineupFromFormation } from "@/lib/lineups/lineup-domain";
import { rebuildActualTimeline } from "@/lib/evidence/actual-timeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Test-only fixture setup for C06-B (Gate C W2 remediation — PR #829) browser-level evidence
 * coverage of the real Lineup/Formation editor: creates TWO real matches for the same team/
 * player pool.
 *
 * 1. A past "history" match with a real lineup assigning one named selected player to a Centre
 *    Midfield slot (grid cell (2,2), the canonical `CM` cell — ADR-0154 §2), with
 *    `matchDurationMinutes` set so the starter interval has a real end. Calls
 *    `rebuildActualTimeline()` — the exact function Live Reporting itself calls on every
 *    mutation (ADR-0096) — directly rather than reimplementing interval math, producing a
 *    genuine, completed-match `ActualPositionInterval` row at CM for that player. The lineup
 *    assignment is written directly (not via the "use server" `assignPlayerToSlot` action),
 *    because that action enforces `requirePlanningEditable()`, which a past-dated match has
 *    already (correctly) closed — this endpoint is seeding completed-match history, not
 *    exercising the live mutation boundary.
 * 2. A future "current" match with its own fresh lineup (same CM slot shape), left unassigned,
 *    for the e2e spec to open and verify the Lineup editor surfaces that player's real CM
 *    evidence while picking/inspecting — proving the planned assignment on THIS match is never
 *    itself treated as completed-match evidence (the brief's explicit requirement).
 *
 * Double-gated like every other `/api/test-agent/*` route (`isTestAgentAuthEnabled()` + a real
 * authenticated session via `requirePageActorContext()`/`requireMutationRole()`/
 * `requireTeamGroupAccess()` — not an auth bypass, only a UI-navigation shortcut for an already
 * genuine, already-authenticated coach, same as `seed-draft-match`/`seed-finalized-match`).
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
    // 1. History match (14 days in the past) — real completed-match evidence source.
    const historyStartsAt = new Date(startsAt.getTime() - 14 * 24 * 60 * 60 * 1000);
    const { matchId: historyMatchId, matchRoundId: historyRoundId } = await createMatchCore(ctx, {
      teamId: team.id,
      opponentText: `${opponentName} (evidence history)`,
      startsAt: historyStartsAt,
      homeAway: "HOME",
      matchType: "FRIENDLY",
      gameFormat: "ELEVEN_A_SIDE",
    });
    const historyRegen = await refreshDraftRound(historyRoundId);
    if (historyRegen.preservedManualDraft) {
      return NextResponse.json({ error: "History round has manual edits that were preserved (unexpected for a freshly created round)." }, { status: 500 });
    }

    const historySelection = await db.selection.findFirst({
      where: { matchId: historyMatchId },
      select: { playerId: true, player: { select: { firstName: true, lastName: true } } },
    });
    if (!historySelection) {
      return NextResponse.json({ error: "History match has no selections to seed evidence for." }, { status: 500 });
    }
    const evidencePlayerId = historySelection.playerId;

    const historyFormation = await db.formation.create({
      data: {
        organisationId: ctx.organisationId,
        name: "C06-B evidence fixture (history)",
        gameFormat: "ELEVEN_A_SIDE",
        source: "SYSTEM",
        slots: {
          create: [
            { organisationId: ctx.organisationId, gridX: 2, gridY: 2, label: "Centre Midfield", shortLabel: "CM", roleType: "MIDFIELDER", acceptedPositionIds: ["CM"], sortOrder: 1 },
          ],
        },
      },
    });

    const historyLineup = await createLineupFromFormation({
      matchId: historyMatchId,
      teamId: team.id,
      formationId: historyFormation.id,
      orgFilter: ctx.orgFilter,
    });
    const historySlotId = historyLineup.assignments[0]!.slotId;
    await db.matchLineupAssignment.updateMany({
      where: { matchLineupId: historyLineup.id, slotId: historySlotId },
      data: { playerId: evidencePlayerId },
    });
    await db.match.update({ where: { id: historyMatchId }, data: { matchDurationMinutes: 90 } });
    await rebuildActualTimeline(historyMatchId);

    // 2. Current match — the one the e2e spec actually opens. Fresh lineup, same CM cell, left
    // unassigned, so the Lineup editor's own evidence integration is what the spec exercises.
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

    const currentFormation = await db.formation.create({
      data: {
        organisationId: ctx.organisationId,
        name: "C06-B evidence fixture (current)",
        gameFormat: "ELEVEN_A_SIDE",
        source: "SYSTEM",
        slots: {
          create: [
            { organisationId: ctx.organisationId, gridX: 2, gridY: 2, label: "Centre Midfield", shortLabel: "CM", roleType: "MIDFIELDER", acceptedPositionIds: ["CM"], sortOrder: 1 },
          ],
        },
      },
    });

    await createLineupFromFormation({
      matchId,
      teamId: team.id,
      formationId: currentFormation.id,
      orgFilter: ctx.orgFilter,
    });

    const evidencePlayerName = `${historySelection.player.firstName} ${historySelection.player.lastName ?? ""}`.trim();

    return NextResponse.json({
      ok: true,
      matchId,
      opponentName,
      matchRoundId,
      evidencePlayerId,
      evidencePlayerName,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not seed the lineup-evidence match.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
