import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import type { MatchStatus } from "@/generated/prisma/client";

export type MatchGuardResult =
  | { success: true; matchId: string }
  | { success: false; error: string };

export type MatchStatusTransitionResult =
  | { success: true; matchId: string; matchRoundId: string }
  | { success: false; error: string };

const VALID_MATCH_STATUSES: MatchStatus[] = ["SCHEDULED", "CANCELLED"];

export function isValidMatchStatus(status: string): status is MatchStatus {
  return VALID_MATCH_STATUSES.includes(status as MatchStatus);
}

export function canCancelMatch(currentStatus: MatchStatus): boolean {
  return currentStatus === "SCHEDULED";
}

export function canReopenMatch(currentStatus: MatchStatus): boolean {
  return currentStatus === "CANCELLED";
}

export async function checkMatchCancellationGuard(matchId: string, orgFilter?: OrgFilterMode): Promise<MatchGuardResult> {
  const where = orgFilter ? { id: matchId, ...orgFilter.filter } : { id: matchId };
  const match = await db.match.findFirst({
    where,
    select: { id: true, status: true },
  });

  if (!match) {
    return { success: false, error: "Match not found." };
  }

  if (!canCancelMatch(match.status)) {
    return { success: false, error: "Match is already cancelled." };
  }

  const existingReport = await db.postMatchReport.findFirst({
    where: { matchId, status: { in: ["REPORTED", "LOCKED"] } },
    select: { id: true },
  });

  if (existingReport) {
    return { success: false, error: "Cannot cancel a match that has a completed post-match report. Resolve the report data conflict first." };
  }

  return { success: true, matchId: match.id };
}

export async function checkMatchDeletionGuard(matchId: string, organisationId?: string): Promise<MatchGuardResult> {
  const where = organisationId ? { id: matchId, organisationId } : { id: matchId };
  const match = await db.match.findFirst({
    where,
    select: { id: true, organisationId: true, selections: { where: { status: "FINALIZED" }, select: { id: true } } },
  });

  if (!match) {
    return { success: false, error: "Match not found." };
  }

  if (organisationId && match.organisationId !== organisationId) {
    return { success: false, error: "Match not found in your organisation." };
  }

  if (match.selections.length > 0) {
    return { success: false, error: "This match has finalised selections and cannot be removed without explicit confirmation." };
  }

  return { success: true, matchId: match.id };
}

export async function cancelMatchDomain(matchId: string, cancelledReason?: string, orgFilter?: OrgFilterMode): Promise<MatchStatusTransitionResult> {
  const guard = await checkMatchCancellationGuard(matchId, orgFilter);
  if (!guard.success) return guard;

  await db.match.update({
    where: { id: matchId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledReason: cancelledReason?.trim() || null,
    },
  });

  const match = await db.match.findFirst({
    where: orgFilter ? { id: matchId, ...orgFilter.filter } : { id: matchId },
    select: { matchRoundId: true },
  });

  return { success: true, matchId, matchRoundId: match!.matchRoundId };
}

export async function reopenMatchDomain(matchId: string, orgFilter?: OrgFilterMode): Promise<MatchStatusTransitionResult> {
  const where = orgFilter ? { id: matchId, ...orgFilter.filter } : { id: matchId };
  const match = await db.match.findFirst({
    where,
    select: { id: true, status: true, matchRoundId: true },
  });

  if (!match) {
    return { success: false, error: "Match not found." };
  }

  if (!canReopenMatch(match.status)) {
    return { success: false, error: "Match is not cancelled." };
  }

  await db.match.update({
    where: { id: matchId },
    data: {
      status: "SCHEDULED",
      cancelledAt: null,
      cancelledReason: null,
    },
  });

  return { success: true, matchId, matchRoundId: match.matchRoundId };
}