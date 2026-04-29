import { SelectionRole, SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { GeneratedRound, GeneratedSelection } from "@/lib/selection/types";

function mapSelectionCategoryToRole(category: string): SelectionRole {
  if (category === "CORE") return SelectionRole.CORE;
  if (category === "SUPPORT") return SelectionRole.SUPPORT;
  if (category === "DEVELOPMENT") return SelectionRole.DEVELOPMENT;
  if (category === "BACKFILL") return SelectionRole.BACKFILL;
  if (category === "CONFIDENCE_REBUILD") return SelectionRole.CONFIDENCE_REBUILD;
  if (category === "CORE_MATCH_DROP") return SelectionRole.CORE_MATCH_DROP;
  if (category === "REDUCED_MATCH_LOAD_DROP") return SelectionRole.REDUCED_MATCH_LOAD_DROP;
  return SelectionRole.MANUAL_OVERRIDE;
}

export async function createGeneratedDraftSelection(
  matchId: string,
  generatedSelection: GeneratedSelection,
) {
  const matchRoundId = generatedSelection.matchRoundId;

  await db.$transaction(
    generatedSelection.selectedPlayers.map((player) =>
      db.selection.create({
        data: {
          matchId,
          matchRoundId,
          playerId: player.playerId,
          role: mapSelectionCategoryToRole(player.selectionCategory),
          status: SelectionStatus.DRAFT,
          explanation: {
            summary: player.selectionReason,
            autoSelected: true,
            manuallyAdded: false,
            manuallyRemoved: false,
            sourceTeamName: player.coreTeamName,
            targetTeamName: generatedSelection.teamName,
            chosenPosition: player.chosenPosition ?? null,
          },
        },
      }),
    ),
  );
}

export async function createGeneratedDraftRound(
  generatedRound: GeneratedRound,
) {
  const matchIds = generatedRound.matchResults.map((m) => m.matchId);

  await db.selection.deleteMany({
    where: {
      matchId: { in: matchIds },
      status: SelectionStatus.DRAFT,
    },
  });

  const allOperations: ReturnType<typeof db.selection.create>[] = [];

  for (const matchResult of generatedRound.matchResults) {
    for (const player of matchResult.selectedPlayers) {
      allOperations.push(
        db.selection.create({
          data: {
            matchId: matchResult.matchId,
            matchRoundId: matchResult.matchRoundId,
            playerId: player.playerId,
            role: mapSelectionCategoryToRole(player.selectionCategory),
            status: SelectionStatus.DRAFT,
            explanation: {
              summary: player.selectionReason,
              autoSelected: true,
              manuallyAdded: false,
              manuallyRemoved: false,
              sourceTeamName: player.coreTeamName,
              targetTeamName: matchResult.teamName,
              chosenPosition: player.chosenPosition ?? null,
            },
          },
        }),
      );
    }
  }

  await db.$transaction(allOperations);
}