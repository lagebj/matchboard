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
 * coverage of the real Lineup/Formation editor: creates TWO real matches for the same team.
 *
 * 1. A "current" match with a real generated squad (`refreshDraftRound`) and its own fresh,
 *    unassigned lineup (same CM slot shape) — the one the e2e spec actually opens. One player is
 *    picked from its OWN real selections, so the evidence player below is GUARANTEED to be a
 *    real candidate in this match's picker, by id, not by a same-looking synthetic display name
 *    (confirmed live, CI run 45019533137: the two matches' independently-generated selection
 *    sets can legitimately contain two DIFFERENT players sharing a look-alike seeded test name
 *    like "Blues Player8" — a name-only match found the wrong row's evidence missing).
 * 2. A "history" match for that SAME player id — a real lineup assigning them to a Centre
 *    Midfield slot (grid cell (2,2), the canonical `CM` cell — ADR-0154 §2), with
 *    `matchDurationMinutes` set so the starter interval has a real end. Calls
 *    `rebuildActualTimeline()` — the exact function Live Reporting itself calls on every
 *    mutation (ADR-0096) — directly rather than reimplementing interval math, producing a
 *    genuine, completed-match `ActualPositionInterval` row at CM for that player. No
 *    `refreshDraftRound()`/`Selection` row is needed for this match at all — real positional
 *    evidence is read from `MatchLineupAssignment`/`FormationSlot` alone, never from
 *    `Selection`. The lineup assignment is written directly (not via the "use server"
 *    `assignPlayerToSlot` action), because that action enforces `requirePlanningEditable()` and
 *    a real per-match coach-authored assignment ceremony neither of which this fixture needs —
 *    this endpoint is seeding completed-match history, not exercising the live mutation
 *    boundary. Proves the current match's own (empty) lineup is never itself treated as
 *    completed-match evidence (the brief's explicit requirement), since the two matches share a
 *    player but not a lineup.
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
    // 1. Current match — the one the e2e spec actually opens. Real generated squad, fresh
    // unassigned lineup, same CM cell.
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

    const currentSelection = await db.selection.findFirst({
      where: { matchId },
      select: { playerId: true, player: { select: { firstName: true, lastName: true } } },
    });
    if (!currentSelection) {
      return NextResponse.json({ error: "Current match has no selections to seed evidence for." }, { status: 500 });
    }
    const evidencePlayerId = currentSelection.playerId;
    const evidencePlayerName = `${currentSelection.player.firstName} ${currentSelection.player.lastName ?? ""}`.trim();

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

    // 2. History match for the SAME player id (by id, never by name) — real completed-match
    // evidence source. No refreshDraftRound()/Selection row needed here at all.
    const historyStartsAt = new Date(startsAt.getTime() - 14 * 24 * 60 * 60 * 1000);
    const { matchId: historyMatchId } = await createMatchCore(ctx, {
      teamId: team.id,
      opponentText: `${opponentName} (evidence history)`,
      startsAt: historyStartsAt,
      homeAway: "HOME",
      matchType: "FRIENDLY",
      gameFormat: "ELEVEN_A_SIDE",
    });

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
