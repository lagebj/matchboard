import { SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { isMatchPlanningEditable, isMatchRoundPlanningEditable } from "@/lib/selection/planning-boundary";
import { requireOpenLeagueSeason, requireOpenLeagueSeasonForRound, requireOpenLeagueSeasonForMatch } from "@/lib/seasons/require-open-league-season";

export type ClearDraftResult = {
  selectionsDeleted: number;
  warningsDeleted: number;
  movementLedgerDeleted: number;
};

export async function clearAllDraftSelections(
  leagueSeasonId: string,
): Promise<ClearDraftResult> {
  await requireOpenLeagueSeason(leagueSeasonId);

  const matchRounds = await db.matchRound.findMany({
    where: {
      leagueSeasonId,
      status: { not: "FINALIZED" },
    },
    select: { id: true },
  });

  const roundIds = matchRounds.map((r) => r.id);

  if (roundIds.length === 0) {
    return { selectionsDeleted: 0, warningsDeleted: 0, movementLedgerDeleted: 0 };
  }

  const [selections, warnings, ledger] = await db.$transaction([
    db.selection.deleteMany({
      where: {
        matchRoundId: { in: roundIds },
        status: SelectionStatus.DRAFT,
      },
    }),
    db.warning.deleteMany({
      where: {
        matchRoundId: { in: roundIds },
      },
    }),
    db.movementLedger.deleteMany({
      where: {
        matchRoundId: { in: roundIds },
        isDraft: true,
      },
    }),
  ]);

  return {
    selectionsDeleted: selections.count,
    warningsDeleted: warnings.count,
    movementLedgerDeleted: ledger.count,
  };
}

export async function clearRoundDraftSelection(
  matchRoundId: string,
): Promise<ClearDraftResult> {
  await requireOpenLeagueSeasonForRound(matchRoundId);

  const planningBoundary = await isMatchRoundPlanningEditable(matchRoundId);
  if (!planningBoundary.editable) {
    throw new Error(planningBoundary.reason ?? "Planning is closed for this round.");
  }

  const matchRound = await db.matchRound.findFirst({
    where: { id: matchRoundId },
    select: { status: true },
  });

  if (!matchRound) {
    throw new Error("Match round not found.");
  }

  if (matchRound.status === "FINALIZED") {
    throw new Error("Cannot clear draft for a finalised round.");
  }

  const [selections, warnings, ledger] = await db.$transaction([
    db.selection.deleteMany({
      where: {
        matchRoundId,
        status: SelectionStatus.DRAFT,
      },
    }),
    db.warning.deleteMany({
      where: {
        matchRoundId,
      },
    }),
    db.movementLedger.deleteMany({
      where: {
        matchRoundId,
        isDraft: true,
      },
    }),
  ]);

  return {
    selectionsDeleted: selections.count,
    warningsDeleted: warnings.count,
    movementLedgerDeleted: ledger.count,
  };
}

export async function clearMatchDraftSelection(
  matchId: string,
): Promise<ClearDraftResult> {
  await requireOpenLeagueSeasonForMatch(matchId);

  const planningBoundary = await isMatchPlanningEditable(matchId);
  if (!planningBoundary.editable) {
    throw new Error(planningBoundary.reason ?? "Planning is closed for this match.");
  }

  const match = await db.match.findFirst({
    where: { id: matchId },
    include: { matchRound: { select: { id: true, status: true } } },
  });

  if (!match) {
    throw new Error("Match not found.");
  }

  if (match.matchRound.status === "FINALIZED") {
    throw new Error("Cannot clear draft for a match in a finalised round.");
  }

  const [selections, ledger] = await db.$transaction([
    db.selection.deleteMany({
      where: {
        matchId,
        status: SelectionStatus.DRAFT,
      },
    }),
    db.movementLedger.deleteMany({
      where: {
        matchId,
        isDraft: true,
      },
    }),
  ]);

  const warnings = await db.warning.deleteMany({
    where: {
      matchRoundId: match.matchRound.id,
      matchId,
    },
  });

  return {
    selectionsDeleted: selections.count,
    warningsDeleted: warnings.count,
    movementLedgerDeleted: ledger.count,
  };
}