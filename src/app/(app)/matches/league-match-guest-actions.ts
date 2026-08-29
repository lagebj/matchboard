"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePageActorContext, requireMutationRole, requireMatchGroupAccess } from "@/lib/auth/actor-context";
import { logMutationEvent } from "@/lib/security/audit-log";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { assertGuestPlayerRegisteredForMatchRound } from "@/lib/matches/league-round-guest-participant";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

// ADR-0106: League Match GuestPlayer usage. Kept as a separate action file mirroring
// match-helper-actions.ts's shape, per ADR-0077's precedent of distinct write paths per
// participant source (LeagueMatchGuestAssignment is guest-only by construction, exactly like
// MatchHelperAssignment is player-only by construction).

async function requireMatchOrgAccess(matchId: string, orgFilter: OrgFilterMode): Promise<void> {
  if (orgFilter.type !== "org") return;
  const match = await db.match.findFirst({ where: { id: matchId, ...orgFilter.filter }, select: { id: true } });
  if (!match) throw new Error("Match not found or access denied.");
}

function revalidateMatchPaths(matchId: string): void {
  revalidatePath(`/matches/${matchId}`);
  revalidatePath(`/matches/${matchId}/live`);
  revalidatePath(`/matches/${matchId}/post-match`);
}

export async function addLeagueMatchGuestAction(input: {
  matchId: string;
  guestPlayerId: string;
  note?: string;
}): Promise<{ success: true; assignmentId: string } | { success: false; error: string }> {
  try {
    return await addLeagueMatchGuestInternal(input);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to add guest player." };
  }
}

async function addLeagueMatchGuestInternal(input: {
  matchId: string;
  guestPlayerId: string;
  note?: string;
}): Promise<{ success: true; assignmentId: string } | { success: false; error: string }> {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  await requireMatchOrgAccess(input.matchId, ctx.orgFilter);
  await requireMatchGroupAccess(ctx, input.matchId);

  const { matchRoundId } = await assertGuestPlayerRegisteredForMatchRound(input.matchId, input.guestPlayerId, ctx.orgFilter);

  let assignmentId: string;
  try {
    const assignment = await db.leagueMatchGuestAssignment.create({
      data: {
        matchId: input.matchId,
        matchRoundId,
        guestPlayerId: input.guestPlayerId,
        note: input.note?.trim() || null,
        addedByUserId: ctx.userId,
        organisationId: ctx.organisationId,
      },
    });
    assignmentId = assignment.id;
  } catch {
    // Unique [matchId, guestPlayerId] race.
    return { success: false, error: "Guest player is already assigned to this match." };
  }

  logMutationEvent("manual_override", ctx.email || "unknown", "league_match_guest_assignment", assignmentId, "success");

  revalidateMatchPaths(input.matchId);

  return { success: true, assignmentId };
}

export async function removeLeagueMatchGuestAction(
  assignmentId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    return await removeLeagueMatchGuestInternal(assignmentId);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to remove guest player." };
  }
}

async function removeLeagueMatchGuestInternal(
  assignmentId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);

  const assignment = await db.leagueMatchGuestAssignment.findFirst({
    where: { id: assignmentId, ...ctx.orgFilter.filter },
    select: { id: true, matchId: true, guestPlayerId: true },
  });
  if (!assignment) return { success: false, error: "Guest assignment not found or access denied." };

  await requireMatchGroupAccess(ctx, assignment.matchId);

  const report = await db.postMatchReport.findFirst({
    where: { matchId: assignment.matchId },
    select: { id: true },
  });
  if (report) {
    const actual = await db.postMatchPlayerActual.findFirst({
      where: { reportId: report.id, guestPlayerId: assignment.guestPlayerId },
    });
    if (actual) {
      return {
        success: false,
        error:
          "Cannot remove: this guest player already has recorded match participation. Remove their participation from the after-match report instead.",
      };
    }
  }

  const liveEvent = await db.liveMatchEvent.findFirst({
    where: {
      matchId: assignment.matchId,
      OR: [{ guestPlayerId: assignment.guestPlayerId }, { secondaryGuestPlayerId: assignment.guestPlayerId }],
    },
    select: { id: true },
  });
  if (liveEvent) {
    return {
      success: false,
      error: "Cannot remove: this guest player already has recorded live match events (goals, assists, rotations, or positions).",
    };
  }

  await db.leagueMatchGuestAssignment.delete({ where: { id: assignmentId } });

  logMutationEvent("manual_override", ctx.email || "unknown", "league_match_guest_assignment", assignmentId, "success");

  revalidateMatchPaths(assignment.matchId);

  return { success: true };
}

export async function getLeagueMatchGuestsAction(matchId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  await requireMatchOrgAccess(matchId, ctx.orgFilter);

  const guests = await db.leagueMatchGuestAssignment.findMany({
    where: { matchId, ...ctx.orgFilter.filter },
    include: {
      guestPlayer: { select: { id: true, name: true, sourceLabel: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return guests.map((g) => ({
    id: g.id,
    guestPlayerId: g.guestPlayerId,
    name: g.guestPlayer.name,
    sourceLabel: g.guestPlayer.sourceLabel,
    note: g.note,
    createdAt: g.createdAt.toISOString(),
  }));
}

/**
 * Guest players eligible to be added to this specific match: registered as a
 * LeagueRoundParticipant of the match's round, and not already assigned to this match.
 */
export async function getLeagueMatchGuestCandidatesAction(matchId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  await requireMatchOrgAccess(matchId, ctx.orgFilter);

  const match = await db.match.findFirst({
    where: { id: matchId, ...ctx.orgFilter.filter },
    select: { matchRoundId: true },
  });
  if (!match) return [];

  const [registered, existingAssignments] = await Promise.all([
    db.leagueRoundParticipant.findMany({
      where: { matchRoundId: match.matchRoundId, guestPlayerId: { not: null }, ...ctx.orgFilter.filter },
      select: {
        guestPlayerId: true,
        guestPlayer: { select: { id: true, name: true, sourceLabel: true } },
      },
    }),
    db.leagueMatchGuestAssignment.findMany({
      where: { matchId, ...ctx.orgFilter.filter },
      select: { guestPlayerId: true },
    }),
  ]);

  const assignedIds = new Set(existingAssignments.map((a) => a.guestPlayerId));

  return registered
    .filter((r): r is typeof r & { guestPlayerId: string; guestPlayer: NonNullable<typeof r.guestPlayer> } =>
      r.guestPlayerId !== null && r.guestPlayer !== null && !assignedIds.has(r.guestPlayerId),
    )
    .map((r) => ({ guestPlayerId: r.guestPlayerId, name: r.guestPlayer.name, sourceLabel: r.guestPlayer.sourceLabel }));
}
