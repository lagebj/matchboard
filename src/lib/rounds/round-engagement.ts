import { db } from "@/lib/db";
import type { PrismaClient } from "@/generated/prisma/client";

type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

export type EngagementSignal = {
  playerId: string;
  playerName: string;
  coreTeamId: string | null;
  coreTeamName: string;
  availabilityStatus: string;
  hasOpportunity: boolean;
  assignedMatchIds: string[];
  reason: string;
};

export type RoundEngagementResult = {
  matchRoundId: string;
  totalEligibleAvailable: number;
  totalWithOpportunity: number;
  totalWithoutOpportunity: number;
  engagementPercentage: number;
  missingOpportunityPlayers: EngagementSignal[];
  cancelledMatchCount: number;
};

const AVAILABLE_STATUSES = new Set(["AVAILABLE", "TENTATIVE"]);

export async function computeRoundEngagement(
  matchRoundId: string,
  client?: TransactionClient,
): Promise<RoundEngagementResult> {
  const prisma = client ?? db;
  const round = await prisma.matchRound.findUnique({
    where: { id: matchRoundId },
  });

  if (!round) {
    return {
      matchRoundId,
      totalEligibleAvailable: 0,
      totalWithOpportunity: 0,
      totalWithoutOpportunity: 0,
      engagementPercentage: 100,
      missingOpportunityPlayers: [],
      cancelledMatchCount: 0,
    };
  }

  const cancelledMatchCount = await prisma.match.count({
    where: { matchRoundId, status: "CANCELLED" },
  });

  const selections = await prisma.selection.findMany({
    where: {
      matchRoundId,
      status: { in: ["DRAFT", "FINALIZED"] },
    },
    select: { playerId: true, matchId: true },
  });

  const selectedPlayerMatchIds = new Map<string, string[]>();
  for (const sel of selections) {
    const existing = selectedPlayerMatchIds.get(sel.playerId) ?? [];
    existing.push(sel.matchId);
    selectedPlayerMatchIds.set(sel.playerId, existing);
  }

  const activePlayers = await prisma.player.findMany({
    where: { removedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      coreTeamId: true,
    },
  });

  const roundAvailabilities = await prisma.availability.findMany({
    where: { matchRoundId },
    select: { playerId: true, status: true },
  });
  const availabilityMap = new Map<string, string>();
  for (const a of roundAvailabilities) {
    availabilityMap.set(a.playerId, a.status);
  }

  const teams = await prisma.team.findMany({
    where: { archivedAt: null },
    select: { id: true, name: true },
  });
  const teamNameMap = new Map(teams.map((t) => [t.id, t.name]));

  const missingOpportunityPlayers: EngagementSignal[] = [];
  let eligibleAvailableCount = 0;
  let withOpportunityCount = 0;

  for (const player of activePlayers) {
    const avail = availabilityMap.get(player.id) ?? "UNKNOWN";
    if (!AVAILABLE_STATUSES.has(avail)) continue;

    eligibleAvailableCount++;
    const assignedMatchIds = selectedPlayerMatchIds.get(player.id) ?? [];
    const hasOpportunity = assignedMatchIds.length > 0;

    if (hasOpportunity) {
      withOpportunityCount++;
    } else {
      const playerName = `${player.firstName}${player.lastName ? ` ${player.lastName}` : ""}`;
      const coreTeamName = player.coreTeamId
        ? teamNameMap.get(player.coreTeamId) ?? "Unknown"
        : "No core team";

      missingOpportunityPlayers.push({
        playerId: player.id,
        playerName,
        coreTeamId: player.coreTeamId,
        coreTeamName,
        availabilityStatus: avail,
        hasOpportunity: false,
        assignedMatchIds: [],
        reason: `${playerName} is available (${avail.toLowerCase()}) but has no planned match opportunity this round`,
      });
    }
  }

  const engagementPercentage =
    eligibleAvailableCount > 0
      ? Math.round((withOpportunityCount / eligibleAvailableCount) * 100)
      : 100;

  return {
    matchRoundId,
    totalEligibleAvailable: eligibleAvailableCount,
    totalWithOpportunity: withOpportunityCount,
    totalWithoutOpportunity: missingOpportunityPlayers.length,
    engagementPercentage,
    missingOpportunityPlayers,
    cancelledMatchCount,
  };
}

export type EngagementOverrideReason =
  | "injured"
  | "late_withdrawal"
  | "parent_logistics"
  | "capacity_impossible"
  | "coach_decision"
  | "other";

export const ENGAGEMENT_OVERRIDE_REASONS: {
  value: EngagementOverrideReason;
  label: string;
  description: string;
}[] = [
  {
    value: "injured",
    label: "Injured",
    description: "Player is injured and cannot participate",
  },
  {
    value: "late_withdrawal",
    label: "Late withdrawal",
    description: "Player withdrew after draft generation",
  },
  {
    value: "parent_logistics",
    label: "Parent logistics",
    description: "Transport or schedule conflict",
  },
  {
    value: "capacity_impossible",
    label: "Capacity impossible",
    description: "Not enough matches to give every player an opportunity",
  },
  {
    value: "coach_decision",
    label: "Coach decision",
    description: "Intentional coaching choice with specific context",
  },
  {
    value: "other",
    label: "Other",
    description: "Other recorded reason",
  },
];

export function validateEngagementOverride(
  reason: string,
  detail: string,
): { valid: boolean; error?: string } {
  const validReasons = ENGAGEMENT_OVERRIDE_REASONS.map((r) => r.value);
  if (!validReasons.includes(reason as EngagementOverrideReason)) {
    return {
      valid: false,
      error: `Invalid override reason. Must be one of: ${validReasons.join(", ")}`,
    };
  }
  if (!detail || detail.trim().length < 3) {
    return {
      valid: false,
      error: "Override detail is required and must be at least 3 characters",
    };
  }
  return { valid: true };
}