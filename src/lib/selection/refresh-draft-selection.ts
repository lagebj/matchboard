import { SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { generateSelection } from "@/lib/selection/generate-selection";
import { createGeneratedDraftSelection } from "@/lib/selection/save-generated-draft";

function hasManualDraftChanges(selection: {
  players: Array<{
    wasManuallyAdded: boolean;
    wasManuallyRemoved: boolean;
  }>;
}) {
  return selection.players.some(
    (player) => player.wasManuallyAdded || player.wasManuallyRemoved,
  );
}

async function cloneDraftSelection(matchId: string) {
  const latestSelection = await db.matchSelection.findFirst({
    where: {
      matchId,
    },
    include: {
      players: {
        select: {
          chosenPosition: true,
          explanation: true,
          playerId: true,
          roleType: true,
          sourceTeamNameSnapshot: true,
          targetTeamNameSnapshot: true,
          wasAutoSelected: true,
          wasManuallyAdded: true,
          wasManuallyRemoved: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  if (!latestSelection) {
    throw new Error("Draft selection not found.");
  }

  await db.matchSelection.create({
    data: {
      finalizedAt: null,
      matchId,
      overrideNotes: latestSelection.overrideNotes,
      players: {
        create: latestSelection.players.map((player) => ({
          chosenPosition: player.chosenPosition,
          explanation: player.explanation,
          playerId: player.playerId,
          roleType: player.roleType,
          sourceTeamNameSnapshot: player.sourceTeamNameSnapshot,
          targetTeamNameSnapshot: player.targetTeamNameSnapshot,
          wasAutoSelected: player.wasAutoSelected,
          wasManuallyAdded: player.wasManuallyAdded,
          wasManuallyRemoved: player.wasManuallyRemoved,
        })),
      },
      status: SelectionStatus.DRAFT,
    },
  });
}

export async function refreshDraftSelection(matchId: string) {
  const match = await db.match.findUnique({
    where: {
      id: matchId,
    },
    include: {
      selections: {
        include: {
          players: {
            select: {
              wasManuallyAdded: true,
              wasManuallyRemoved: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }],
        take: 1,
      },
    },
  });

  if (!match) {
    throw new Error("Match not found.");
  }

  const latestSelection = match.selections[0] ?? null;

  if (latestSelection?.status === SelectionStatus.FINALIZED) {
    throw new Error("Finalized matches cannot be recalculated.");
  }

  if (latestSelection && hasManualDraftChanges(latestSelection)) {
    await cloneDraftSelection(match.id);
    return {
      preservedManualDraft: true,
    };
  }

  const generatedSelection = await generateSelection(match.id);
  await createGeneratedDraftSelection(match.id, generatedSelection);

  return {
    preservedManualDraft: false,
  };
}

export async function refreshDraftSelections(matchIds: string[]) {
  for (const matchId of matchIds) {
    await refreshDraftSelection(matchId);
  }
}
