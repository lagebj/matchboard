import { SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { GeneratedSelection } from "@/lib/selection/types";

export async function createGeneratedDraftSelection(
  matchId: string,
  generatedSelection: GeneratedSelection,
) {
  await db.matchSelection.create({
    data: {
      matchId,
      status: SelectionStatus.DRAFT,
      finalizedAt: null,
      players: {
        create: generatedSelection.selectedPlayers.map((player) => ({
          chosenPosition: player.chosenPosition ?? null,
          explanation: player.selectionReason,
          playerId: player.playerId,
          roleType:
            player.selectionCategory === "CORE"
              ? "CORE"
              : player.selectionCategory === "SUPPORT"
                ? "SUPPORT"
                : player.selectionCategory === "DEVELOPMENT"
                  ? "DEVELOPMENT"
                  : "FLOAT",
          sourceTeamNameSnapshot: player.coreTeamName,
          targetTeamNameSnapshot: generatedSelection.teamName,
          wasAutoSelected: true,
          wasManuallyAdded: false,
          wasManuallyRemoved: false,
        })),
      },
    },
  });
}
