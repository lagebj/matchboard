"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePageActorContext, requireMutationRole, requireMatchGroupAccess } from "@/lib/auth/actor-context";
import { logMutationEvent } from "@/lib/security/audit-log";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { assertGuestPlayerRegisteredForMatchRound } from "@/lib/matches/league-round-guest-participant";
import { createGuestPlayer, GUEST_PLAYER_NAME_MAX_LENGTH, GUEST_PLAYER_SOURCE_LABEL_MAX_LENGTH, GUEST_PLAYER_NOTE_MAX_LENGTH } from "@/lib/guest-players/guest-player";
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
  skipRoundRegistration?: boolean;
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
  skipRoundRegistration?: boolean;
}): Promise<{ success: true; assignmentId: string } | { success: false; error: string }> {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  await requireMatchOrgAccess(input.matchId, ctx.orgFilter);
  await requireMatchGroupAccess(ctx, input.matchId);

  let matchRoundId: string;

  if (input.skipRoundRegistration) {
    // ADR-0151: Emergency guest from Match Details — auto-register if not already registered
    const match = await db.match.findFirst({
      where: { id: input.matchId, ...ctx.orgFilter.filter },
      select: { matchRoundId: true },
    });
    if (!match) return { success: false, error: "Match not found or access denied." };
    matchRoundId = match.matchRoundId;

    const existing = await db.leagueRoundParticipant.findFirst({
      where: { matchRoundId, guestPlayerId: input.guestPlayerId },
    });
    if (!existing) {
      await db.leagueRoundParticipant.create({
        data: {
          matchRoundId,
          guestPlayerId: input.guestPlayerId,
          organisationId: ctx.organisationId,
        },
      });
    }
  } else {
    const result = await assertGuestPlayerRegisteredForMatchRound(input.matchId, input.guestPlayerId, ctx.orgFilter);
    matchRoundId = result.matchRoundId;
  }

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
 * Also includes unassigned group GuestPlayers not yet in this match (ADR-0151:
 * emergency GuestPlayer from Match Details without Round Board mutation).
 */
export async function getLeagueMatchGuestCandidatesAction(matchId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  await requireMatchOrgAccess(matchId, ctx.orgFilter);

  const match = await db.match.findFirst({
    where: { id: matchId, ...ctx.orgFilter.filter },
    select: { matchRoundId: true, team: { select: { footballGroupId: true } } },
  });
  if (!match) return [];

  const [registered, existingAssignments, groupGuests] = await Promise.all([
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
    db.guestPlayer.findMany({
      where: { footballGroupId: match.team.footballGroupId, active: true, ...ctx.orgFilter.filterNullable },
      select: { id: true, name: true, sourceLabel: true },
    }),
  ]);

  const assignedIds = new Set(existingAssignments.map((a) => a.guestPlayerId));

  // Merge registered participants and group guests, deduplicating by guestPlayerId
  const seenIds = new Set<string>();
  const candidates: { guestPlayerId: string; name: string; sourceLabel: string | null }[] = [];

  // Registered round participants first (higher priority)
  for (const r of registered) {
    if (!r.guestPlayerId || !r.guestPlayer || assignedIds.has(r.guestPlayerId) || seenIds.has(r.guestPlayerId)) continue;
    seenIds.add(r.guestPlayerId);
    candidates.push({ guestPlayerId: r.guestPlayerId, name: r.guestPlayer.name, sourceLabel: r.guestPlayer.sourceLabel });
  }

  // Then other group guests not yet assigned or registered
  for (const g of groupGuests) {
    if (assignedIds.has(g.id) || seenIds.has(g.id)) continue;
    seenIds.add(g.id);
    candidates.push({ guestPlayerId: g.id, name: g.name, sourceLabel: g.sourceLabel });
  }

  return candidates;
}

export async function createAndAddMatchGuestAction(input: {
  matchId: string;
  name: string;
  sourceLabel?: string | null;
  note?: string | null;
}): Promise<{ success: true; assignmentId: string; guestPlayerId: string } | { success: false; error: string }> {
  try {
    return await createAndAddMatchGuestInternal(input);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to create and add guest player." };
  }
}

async function createAndAddMatchGuestInternal(input: {
  matchId: string;
  name: string;
  sourceLabel?: string | null;
  note?: string | null;
}): Promise<{ success: true; assignmentId: string; guestPlayerId: string } | { success: false; error: string }> {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  await requireMatchOrgAccess(input.matchId, ctx.orgFilter);
  await requireMatchGroupAccess(ctx, input.matchId);

  const trimmedName = input.name.trim();
  if (!trimmedName) {
    return { success: false, error: "Name is required." };
  }
  if (trimmedName.length > GUEST_PLAYER_NAME_MAX_LENGTH) {
    return { success: false, error: `Name must be ${GUEST_PLAYER_NAME_MAX_LENGTH} characters or fewer.` };
  }
  if (input.sourceLabel && input.sourceLabel.trim().length > GUEST_PLAYER_SOURCE_LABEL_MAX_LENGTH) {
    return { success: false, error: `Source must be ${GUEST_PLAYER_SOURCE_LABEL_MAX_LENGTH} characters or fewer.` };
  }
  if (input.note && input.note.trim().length > GUEST_PLAYER_NOTE_MAX_LENGTH) {
    return { success: false, error: `Note must be ${GUEST_PLAYER_NOTE_MAX_LENGTH} characters or fewer.` };
  }

  const match = await db.match.findFirst({
    where: { id: input.matchId, ...ctx.orgFilter.filter },
    select: { matchRoundId: true, team: { select: { footballGroupId: true } } },
  });
  if (!match) return { success: false, error: "Match not found or access denied." };

  const guestResult = await createGuestPlayer({
    organisationId: ctx.organisationId,
    footballGroupId: match.team.footballGroupId,
    name: trimmedName,
    sourceLabel: input.sourceLabel?.trim() || null,
    note: input.note?.trim() || null,
  });
  if (!guestResult.success) {
    return { success: false, error: guestResult.error };
  }

  const matchRoundId = match.matchRoundId;

  const existing = await db.leagueRoundParticipant.findFirst({
    where: { matchRoundId, guestPlayerId: guestResult.guestPlayer.id },
  });
  if (!existing) {
    await db.leagueRoundParticipant.create({
      data: {
        matchRoundId,
        guestPlayerId: guestResult.guestPlayer.id,
        organisationId: ctx.organisationId,
      },
    });
  }

  let assignmentId: string;
  try {
    const assignment = await db.leagueMatchGuestAssignment.create({
      data: {
        matchId: input.matchId,
        matchRoundId,
        guestPlayerId: guestResult.guestPlayer.id,
        note: input.note?.trim() || null,
        addedByUserId: ctx.userId,
        organisationId: ctx.organisationId,
      },
    });
    assignmentId = assignment.id;
  } catch {
    return { success: false, error: "Guest player is already assigned to this match." };
  }

  logMutationEvent("manual_override", ctx.email || "unknown", "league_match_guest_assignment", assignmentId, "success");

  revalidateMatchPaths(input.matchId);

  return { success: true, assignmentId, guestPlayerId: guestResult.guestPlayer.id };
}
