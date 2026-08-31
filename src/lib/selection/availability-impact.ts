import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { computeRoundPlanIntegrity, type RoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";

export type AvailabilityChangeImpact = {
  playerId: string;
  playerName: string;
  previousAvailability: string;
  newAvailability: string;
  affectedRounds: AffectedRoundSummary[];
};

export type AffectedRoundSummary = {
  matchRoundId: string;
  roundName: string;
  roundStatus: string;
  hasFinalizedSelections: boolean;
  impactSummary: string;
  integrityBefore: RoundPlanIntegrity | null;
  /** True when this round's planning boundary has already closed for this player's selection —
   * ADR-0109: there is no coach "unfinalize" action; a genuine reschedule of the affected match
   * (which reopens planning automatically when safe) is the only way to make it editable again. */
  wouldRequireUnfinalize: boolean;
};

export async function analyzeAvailabilityChangeImpact(
  playerId: string,
  newAvailability: string,
  orgFilter: OrgFilterMode,
): Promise<AvailabilityChangeImpact | null> {
  const player = await db.player.findFirst({
    where: { id: playerId, ...orgFilter.filter },
    select: { id: true, firstName: true, lastName: true, currentAvailability: true },
  });

  if (!player) return null;

  const selections = await db.selection.findMany({
    where: {
      playerId,
      status: { in: ["DRAFT", "FINALIZED"] },
      ...orgFilter.filter,
    },
    select: {
      id: true,
      status: true,
      matchId: true,
      match: {
        select: {
          id: true,
          matchRoundId: true,
          matchRound: {
            select: { id: true, name: true, status: true },
          },
        },
      },
    },
  });

  const affectedRoundIds = [...new Set(selections.map((s) => s.match.matchRound.id))];

  const affectedRounds: AffectedRoundSummary[] = [];

  for (const roundId of affectedRoundIds) {
    const roundSelections = selections.filter((s) => s.match.matchRound.id === roundId);
    const hasFinalized = roundSelections.some((s) => s.status === "FINALIZED");

    let integrityBefore: RoundPlanIntegrity | null = null;
    try {
      integrityBefore = await computeRoundPlanIntegrity(roundId);
    } catch {
      // Round may not have generated selections yet
    }

    const roundName = roundSelections[0]?.match.matchRound.name ?? roundId;
    const roundStatus = roundSelections[0]?.match.matchRound.status ?? "NOT_GENERATED";

    let impactSummary: string;
    if (hasFinalized) {
      impactSummary = `Player has finalized selections in this round — its planning boundary has closed. Reschedule the affected match to reopen planning before regenerating, if it hasn't actually started.`;
    } else if (roundSelections.length > 0) {
      impactSummary = `Player has draft selections in this round. Plan integrity will be recalculated.`;
    } else {
      impactSummary = `Player has no selections in this round. Availability change affects future generation only.`;
    }

    affectedRounds.push({
      matchRoundId: roundId,
      roundName,
      roundStatus,
      hasFinalizedSelections: hasFinalized,
      impactSummary,
      integrityBefore,
      wouldRequireUnfinalize: hasFinalized,
    });
  }

  return {
    playerId: player.id,
    playerName: `${player.firstName} ${player.lastName ?? ""}`.trim(),
    previousAvailability: player.currentAvailability,
    newAvailability,
    affectedRounds,
  };
}