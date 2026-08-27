import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import type { SelectionRole, PlannedAbsenceReason } from "@/generated/prisma/client";

// Effective League Match roster and helper eligibility (ADR-0077). Mirrors the pattern in
// src/lib/events/event-match-eligibility.ts: effective roster = planned squad ∪ helpers, with a
// deliberately narrower eligibility check than the Event version — no round-finalisation block,
// no time/round-conflict block. See the ADR for why both omissions are intentional, not gaps.

export type EffectiveLeagueMatchRosterEntry = {
  playerId: string;
  firstName: string;
  lastName: string | null;
  primaryPosition: string | null;
  shirtNumber: number | null;
  source: "planned" | "helper";
  role: SelectionRole | null;
  teamId: string;
  teamName: string;
  /** Match-specific absence (production consistency pass item #3) — null means the player is an
   * active participant for this match. Non-null must exclude them from any action requiring an
   * active participant (scorer/assist selection, on-pitch state) while still leaving them
   * visible in the match roster. Does not affect their Selection/round-team assignment. */
  absenceReason: PlannedAbsenceReason | null;
  isActiveParticipant: boolean;
};

export async function getEffectiveLeagueMatchRoster(
  matchId: string,
  orgFilter: OrgFilterMode,
): Promise<EffectiveLeagueMatchRosterEntry[]> {
  const match = await db.match.findFirst({
    where: { id: matchId, ...orgFilter.filter },
    select: { id: true, teamId: true, team: { select: { id: true, name: true } } },
  });
  if (!match) return [];

  const [selections, helpers, absences] = await Promise.all([
    db.selection.findMany({
      where: { matchId },
      select: {
        role: true,
        player: {
          select: { id: true, firstName: true, lastName: true, primaryPosition: true, shirtNumber: true },
        },
      },
    }),
    db.matchHelperAssignment.findMany({
      where: { matchId },
      select: {
        player: {
          select: { id: true, firstName: true, lastName: true, primaryPosition: true, shirtNumber: true },
        },
      },
    }),
    db.matchReportAbsence.findMany({
      where: { matchId },
      select: { playerId: true, reason: true },
    }),
  ]);

  const absenceByPlayerId = new Map(absences.map((a) => [a.playerId, a.reason]));

  const entries: EffectiveLeagueMatchRosterEntry[] = selections.map((s) => ({
    playerId: s.player.id,
    firstName: s.player.firstName,
    lastName: s.player.lastName,
    primaryPosition: s.player.primaryPosition,
    shirtNumber: s.player.shirtNumber,
    source: "planned",
    role: s.role,
    teamId: match.teamId,
    teamName: match.team.name,
    absenceReason: absenceByPlayerId.get(s.player.id) ?? null,
    isActiveParticipant: !absenceByPlayerId.has(s.player.id),
  }));

  for (const h of helpers) {
    entries.push({
      playerId: h.player.id,
      firstName: h.player.firstName,
      lastName: h.player.lastName,
      primaryPosition: h.player.primaryPosition,
      shirtNumber: h.player.shirtNumber,
      source: "helper",
      role: null,
      teamId: match.teamId,
      teamName: match.team.name,
      absenceReason: absenceByPlayerId.get(h.player.id) ?? null,
      isActiveParticipant: !absenceByPlayerId.has(h.player.id),
    });
  }

  return entries;
}

export type LeagueMatchHelperCandidate = {
  playerId: string;
  firstName: string;
  lastName: string | null;
  primaryPosition: string | null;
  currentRoundTeamId: string | null;
  currentRoundTeamName: string | null;
};

/**
 * Players selectable as a helper for this match: every active player in the organisation who is
 * not already a participant in this exact match (not already planned, not already a helper here).
 * A player's existing assignment elsewhere in the same round is shown for context, never used to
 * exclude them — that is the entire point of this feature.
 */
export async function getLeagueMatchHelperCandidates(
  matchId: string,
  orgFilter: OrgFilterMode,
): Promise<LeagueMatchHelperCandidate[]> {
  const match = await db.match.findFirst({
    where: { id: matchId, ...orgFilter.filter },
    select: { id: true, matchRoundId: true },
  });
  if (!match) return [];

  const [existingParticipantIds, roundSelections, players] = await Promise.all([
    getParticipantPlayerIds(matchId),
    db.selection.findMany({
      where: { matchRoundId: match.matchRoundId },
      select: { playerId: true, match: { select: { teamId: true, team: { select: { name: true } } } } },
    }),
    db.player.findMany({
      where: { active: true, removedAt: null, ...orgFilter.filter },
      select: { id: true, firstName: true, lastName: true, primaryPosition: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);

  const roundTeamByPlayer = new Map<string, { teamId: string; teamName: string }>();
  for (const s of roundSelections) {
    if (!roundTeamByPlayer.has(s.playerId)) {
      roundTeamByPlayer.set(s.playerId, { teamId: s.match.teamId, teamName: s.match.team.name });
    }
  }

  return players
    .filter((p) => !existingParticipantIds.has(p.id))
    .map((p) => ({
      playerId: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      primaryPosition: p.primaryPosition,
      currentRoundTeamId: roundTeamByPlayer.get(p.id)?.teamId ?? null,
      currentRoundTeamName: roundTeamByPlayer.get(p.id)?.teamName ?? null,
    }));
}

async function getParticipantPlayerIds(matchId: string): Promise<Set<string>> {
  const [selections, helpers] = await Promise.all([
    db.selection.findMany({ where: { matchId }, select: { playerId: true } }),
    db.matchHelperAssignment.findMany({ where: { matchId }, select: { playerId: true } }),
  ]);
  return new Set([...selections.map((s) => s.playerId), ...helpers.map((h) => h.playerId)]);
}

export async function assertLeagueMatchHelperEligible(
  matchId: string,
  playerId: string,
  orgFilter: OrgFilterMode,
): Promise<{ eligible: boolean; reason: string | null }> {
  const match = await db.match.findFirst({
    where: { id: matchId, ...orgFilter.filter },
    select: { id: true, status: true },
  });
  if (!match) {
    return { eligible: false, reason: "Match not found or access denied." };
  }
  if (match.status === "CANCELLED") {
    return { eligible: false, reason: "Cannot add a helper to a cancelled match." };
  }

  const player = await db.player.findFirst({
    where: { id: playerId, active: true, removedAt: null, ...orgFilter.filter },
    select: { id: true },
  });
  if (!player) {
    return { eligible: false, reason: "Player not found or access denied." };
  }

  const participantIds = await getParticipantPlayerIds(matchId);
  if (participantIds.has(playerId)) {
    return { eligible: false, reason: "Player is already a participant in this match." };
  }

  return { eligible: true, reason: null };
}
