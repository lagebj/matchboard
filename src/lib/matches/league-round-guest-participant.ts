import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

// ADR-0106: GuestPlayer participation in a League Round. A GuestPlayer must first be registered
// as a LeagueRoundParticipant of a Round before it can be assigned to any Match within that
// Round (spec: "a GuestPlayer is assignable to a Match only if it's already a
// LeagueRoundParticipant of that Match's Round") -- this module is the one place that enforces
// both the Round registration prerequisite and the Group-isolation boundary (a GuestPlayer may
// only be registered for a Round belonging to its own Group's LeagueSeason).
//
// Scope decision (ADR-0106 §1.3): only GuestPlayers populate LeagueRoundParticipant in this
// implementation. Permanent Players keep their existing Selection/Availability-based Round
// presence unchanged.

async function getRoundFootballGroupId(matchRoundId: string, orgFilter: OrgFilterMode): Promise<string | null> {
  const round = await db.matchRound.findFirst({
    where: { id: matchRoundId, ...orgFilter.filter },
    select: { leagueSeason: { select: { footballGroupId: true } } },
  });
  return round?.leagueSeason.footballGroupId ?? null;
}

export async function assertGuestPlayerBelongsToRoundGroup(
  matchRoundId: string,
  guestPlayerId: string,
  orgFilter: OrgFilterMode,
): Promise<void> {
  const [footballGroupId, guestPlayer] = await Promise.all([
    getRoundFootballGroupId(matchRoundId, orgFilter),
    db.guestPlayer.findFirst({
      where: { id: guestPlayerId, ...orgFilter.filter },
      select: { footballGroupId: true, active: true },
    }),
  ]);

  if (!footballGroupId) throw new Error("Round not found or access denied.");
  if (!guestPlayer) throw new Error("Guest player not found or access denied.");
  if (!guestPlayer.active) throw new Error("Guest player is inactive.");
  if (guestPlayer.footballGroupId !== footballGroupId) {
    throw new Error("Guest player does not belong to this Round's Group.");
  }
}

export async function registerGuestPlayerForRound(
  matchRoundId: string,
  guestPlayerId: string,
  orgFilter: OrgFilterMode,
): Promise<{ success: true } | { success: false; error: string }> {
  await assertGuestPlayerBelongsToRoundGroup(matchRoundId, guestPlayerId, orgFilter);

  try {
    await db.leagueRoundParticipant.upsert({
      where: { matchRoundId_guestPlayerId: { matchRoundId, guestPlayerId } },
      create: { matchRoundId, guestPlayerId, organisationId: orgFilter.filter.organisationId },
      update: {},
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to register guest player for round." };
  }
}

export async function unregisterGuestPlayerFromRound(
  matchRoundId: string,
  guestPlayerId: string,
  orgFilter: OrgFilterMode,
): Promise<{ success: true } | { success: false; error: string }> {
  const existingAssignment = await db.leagueMatchGuestAssignment.findFirst({
    where: { matchRoundId, guestPlayerId, ...orgFilter.filter },
    select: { id: true },
  });
  if (existingAssignment) {
    return {
      success: false,
      error: "Cannot remove: this guest player is assigned to a Match in this Round. Remove that assignment first.",
    };
  }

  await db.leagueRoundParticipant.deleteMany({
    where: { matchRoundId, guestPlayerId, ...orgFilter.filter },
  });
  return { success: true };
}

export type RoundGuestParticipant = {
  guestPlayerId: string;
  name: string;
  sourceLabel: string | null;
};

export async function getRoundGuestParticipants(
  matchRoundId: string,
  orgFilter: OrgFilterMode,
): Promise<RoundGuestParticipant[]> {
  const participants = await db.leagueRoundParticipant.findMany({
    where: { matchRoundId, guestPlayerId: { not: null }, ...orgFilter.filter },
    select: {
      guestPlayerId: true,
      guestPlayer: { select: { id: true, name: true, sourceLabel: true } },
    },
  });

  return participants
    .filter((p): p is typeof p & { guestPlayerId: string; guestPlayer: NonNullable<typeof p.guestPlayer> } =>
      p.guestPlayerId !== null && p.guestPlayer !== null,
    )
    .map((p) => ({ guestPlayerId: p.guestPlayerId, name: p.guestPlayer.name, sourceLabel: p.guestPlayer.sourceLabel }));
}

export async function getAvailableGuestPlayersForRound(
  matchRoundId: string,
  orgFilter: OrgFilterMode,
): Promise<RoundGuestParticipant[]> {
  const footballGroupId = await getRoundFootballGroupId(matchRoundId, orgFilter);
  if (!footballGroupId) return [];

  const [registered, guestPlayers] = await Promise.all([
    db.leagueRoundParticipant.findMany({
      where: { matchRoundId, guestPlayerId: { not: null }, ...orgFilter.filter },
      select: { guestPlayerId: true },
    }),
    db.guestPlayer.findMany({
      where: { footballGroupId, active: true, ...orgFilter.filter },
      select: { id: true, name: true, sourceLabel: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const registeredIds = new Set(registered.map((r) => r.guestPlayerId));
  return guestPlayers
    .filter((g) => !registeredIds.has(g.id))
    .map((g) => ({ guestPlayerId: g.id, name: g.name, sourceLabel: g.sourceLabel }));
}

export async function assertGuestPlayerRegisteredForMatchRound(
  matchId: string,
  guestPlayerId: string,
  orgFilter: OrgFilterMode,
): Promise<{ matchRoundId: string }> {
  const match = await db.match.findFirst({
    where: { id: matchId, ...orgFilter.filter },
    select: { matchRoundId: true },
  });
  if (!match) throw new Error("Match not found or access denied.");

  const participant = await db.leagueRoundParticipant.findFirst({
    where: { matchRoundId: match.matchRoundId, guestPlayerId, ...orgFilter.filter },
    select: { id: true },
  });
  if (!participant) {
    throw new Error("Guest player is not registered as a participant for this match's Round.");
  }

  return { matchRoundId: match.matchRoundId };
}
