'use server'

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SelectionRole, SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { buildPathWithSearch } from "@/lib/build-path-with-search";
import { generateSelection } from "@/lib/selection/generate-selection";
import { refreshDraftSelections } from "@/lib/selection/refresh-draft-selection";
import { createGeneratedDraftSelection } from "@/lib/selection/save-generated-draft";

type SelectionPlayerWriteInput = {
  explanation: string;
  playerId: string;
  roleType: SelectionRole;
  sourceTeamNameSnapshot: string;
  targetTeamNameSnapshot: string;
  wasAutoSelected: boolean;
  wasManuallyAdded: boolean;
  wasManuallyRemoved: boolean;
};

type BaselineSelectionRow = SelectionPlayerWriteInput;

function readText(formData: FormData, fieldName: string): string {
  const value = formData.get(fieldName);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function readSelectionStatus(formData: FormData): SelectionStatus {
  const intent = readText(formData, "intent");

  if (intent === SelectionStatus.DRAFT || intent === SelectionStatus.FINALIZED) {
    return intent;
  }

  throw new Error("Selection intent must be DRAFT or FINALIZED.");
}

function readReturnPath(formData: FormData, matchId: string): string {
  const returnPath = readText(formData, "returnPath");

  if (returnPath.startsWith("/")) {
    return returnPath;
  }

  return `/selection/${matchId}`;
}

function readSelectionRole(formData: FormData, playerId: string): SelectionRole {
  const value = formData.get(`roleType:${playerId}`);

  if (
    value === SelectionRole.CORE ||
    value === SelectionRole.DEVELOPMENT ||
    value === SelectionRole.FLOAT ||
    value === SelectionRole.SUPPORT ||
    value === SelectionRole.MANUAL
  ) {
    return value;
  }

  return SelectionRole.MANUAL;
}

function getSelectionRoleFromCategory(category: string): SelectionRole {
  if (
    category === SelectionRole.CORE ||
    category === SelectionRole.FLOAT ||
    category === SelectionRole.SUPPORT ||
    category === SelectionRole.DEVELOPMENT
  ) {
    return category;
  }

  return SelectionRole.MANUAL;
}

async function createSelectionRecord(
  matchId: string,
  status: SelectionStatus,
  players: SelectionPlayerWriteInput[],
  overrideNotes?: string | null,
) {
  const match = await db.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
    },
  });

  if (!match) {
    throw new Error("Match not found.");
  }

  await db.matchSelection.create({
    data: {
      matchId: match.id,
      status,
      finalizedAt: status === SelectionStatus.FINALIZED ? new Date() : null,
      overrideNotes: overrideNotes || null,
      players: {
        create: players.map((player) => ({
          playerId: player.playerId,
          roleType: player.roleType,
          sourceTeamNameSnapshot: player.sourceTeamNameSnapshot,
          targetTeamNameSnapshot: player.targetTeamNameSnapshot,
          explanation: player.explanation,
          wasAutoSelected: player.wasAutoSelected,
          wasManuallyAdded: player.wasManuallyAdded,
          wasManuallyRemoved: player.wasManuallyRemoved,
        })),
      },
    },
  });
}

async function getBaselineSelectionRows(
  matchId: string,
  targetTeamName: string,
  formData: FormData,
): Promise<BaselineSelectionRow[]> {
  const baselineSelectionId = readText(formData, "baselineSelectionId");

  if (baselineSelectionId) {
    const baselineSelection = await db.matchSelection.findFirst({
      where: {
        id: baselineSelectionId,
        matchId,
      },
      select: {
        players: {
          select: {
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
    });

    if (baselineSelection) {
      return baselineSelection.players.map((player) => ({
        explanation: player.explanation ?? "",
        playerId: player.playerId,
        roleType: player.roleType,
        sourceTeamNameSnapshot: player.sourceTeamNameSnapshot,
        targetTeamNameSnapshot: player.targetTeamNameSnapshot || targetTeamName,
        wasAutoSelected: player.wasAutoSelected,
        wasManuallyAdded: player.wasManuallyAdded,
        wasManuallyRemoved: player.wasManuallyRemoved,
      }));
    }
  }

  const generatedPlayerIds = [...new Set(formData.getAll("generatedBaselinePlayerIds"))].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );

  return generatedPlayerIds.map((playerId) => ({
    explanation: readText(formData, `generatedBaselineExplanation:${playerId}`),
    playerId,
    roleType: getSelectionRoleFromCategory(
      readText(formData, `generatedBaselineRoleType:${playerId}`),
    ),
    sourceTeamNameSnapshot: readText(formData, `generatedBaselineSourceTeam:${playerId}`),
    targetTeamNameSnapshot: targetTeamName,
    wasAutoSelected: true,
    wasManuallyAdded: false,
    wasManuallyRemoved: false,
  }));
}

function buildManualAddExplanation(playerWasPreviouslyRemoved: boolean): string {
  if (playerWasPreviouslyRemoved) {
    return "Manually re-added to the squad after being removed from the previous saved selection.";
  }

  return "Manually added to the squad.";
}

function buildManualRemovalExplanation(playerWasPreviouslyAutoSelected: boolean): string {
  if (playerWasPreviouslyAutoSelected) {
    return "Manually removed from the generated recommendation.";
  }

  return "Manually removed from the saved selection.";
}

export async function generateSuggestedSelectionAction(matchId: string) {
  const match = await db.match.findUnique({
    where: { id: matchId },
    select: { id: true },
  });

  if (!match) {
    redirect(
      buildPathWithSearch(`/matches`, {
        error: "The selected match was not found.",
      }),
    );
  }

  redirect(
    buildPathWithSearch(`/selection/${matchId}`, {
      generated: true,
    }),
  );
}

export async function acceptGeneratedSelectionAction(matchId: string) {
  try {
    const generatedSelection = await generateSelection(matchId);
    await createGeneratedDraftSelection(matchId, generatedSelection);
  } catch (error) {
    redirect(
      buildPathWithSearch(`/selection/${matchId}`, {
        error: error instanceof Error ? error.message : "Could not accept the generated squad.",
        generated: true,
      }),
    );
  }

  revalidatePath(`/selection/${matchId}`);
  redirect(
    buildPathWithSearch(`/selection/${matchId}`, {
      saved: "draft",
      accepted: "generated",
    }),
  );
}

export async function saveManualSelectionAction(matchId: string, formData: FormData) {
  let status: SelectionStatus;
  const shouldReturnToGenerated = readText(formData, "returnToGenerated") === "1";
  const returnPath = readReturnPath(formData, matchId);

  try {
    status = readSelectionStatus(formData);
    const overrideNotes = readText(formData, "overrideNotes");
    const selectedPlayerIds = [...new Set(formData.getAll("selectedPlayerIds"))].filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );

    const match = await db.match.findUnique({
      where: { id: matchId },
      include: {
        targetTeam: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!match) {
      throw new Error("Match not found.");
    }

    const baselineRows = await getBaselineSelectionRows(match.id, match.targetTeam.name, formData);
    const baselineRowByPlayerId = new Map(
      baselineRows.map((player) => [player.playerId, player]),
    );

    const selectedPlayers = selectedPlayerIds.length
      ? await db.player.findMany({
          where: {
            removedAt: null,
            active: true,
            id: {
              in: selectedPlayerIds,
            },
          },
          include: {
            coreTeam: {
              select: {
                name: true,
              },
            },
          },
          orderBy: [
            {
              coreTeam: {
                name: "asc",
              },
            },
            { firstName: "asc" },
            { lastName: "asc" },
            { playerCode: "asc" },
          ],
        })
      : [];

    if (selectedPlayers.length !== selectedPlayerIds.length) {
      throw new Error("One or more selected players are missing or inactive.");
    }

    const selectionPlayers: SelectionPlayerWriteInput[] = selectedPlayers.map((player) => {
      const baselineRow = baselineRowByPlayerId.get(player.id);
      const roleType = readSelectionRole(formData, player.id);

      if (!baselineRow) {
        return {
          explanation: buildManualAddExplanation(false),
          playerId: player.id,
          roleType,
          sourceTeamNameSnapshot: player.coreTeam.name,
          targetTeamNameSnapshot: match.targetTeam.name,
          wasAutoSelected: false,
          wasManuallyAdded: true,
          wasManuallyRemoved: false,
        };
      }

      if (baselineRow.wasManuallyRemoved) {
        return {
          explanation: buildManualAddExplanation(true),
          playerId: player.id,
          roleType,
          sourceTeamNameSnapshot: baselineRow.sourceTeamNameSnapshot,
          targetTeamNameSnapshot: baselineRow.targetTeamNameSnapshot,
          wasAutoSelected: baselineRow.wasAutoSelected,
          wasManuallyAdded: true,
          wasManuallyRemoved: false,
        };
      }

      return {
        explanation: baselineRow.explanation,
        playerId: player.id,
        roleType,
        sourceTeamNameSnapshot: baselineRow.sourceTeamNameSnapshot,
        targetTeamNameSnapshot: baselineRow.targetTeamNameSnapshot,
        wasAutoSelected: baselineRow.wasAutoSelected,
        wasManuallyAdded: baselineRow.wasManuallyAdded,
        wasManuallyRemoved: false,
      };
    });

    for (const baselineRow of baselineRows) {
      const stillSelected = selectedPlayers.some((player) => player.id === baselineRow.playerId);

      if (stillSelected) {
        continue;
      }

      selectionPlayers.push({
        explanation: buildManualRemovalExplanation(baselineRow.wasAutoSelected),
        playerId: baselineRow.playerId,
        roleType: baselineRow.roleType,
        sourceTeamNameSnapshot: baselineRow.sourceTeamNameSnapshot,
        targetTeamNameSnapshot: baselineRow.targetTeamNameSnapshot,
        wasAutoSelected: baselineRow.wasAutoSelected,
        wasManuallyAdded: baselineRow.wasManuallyAdded,
        wasManuallyRemoved: true,
      });
    }

    await createSelectionRecord(
      match.id,
      status,
      selectionPlayers,
      overrideNotes || null,
    );

    const draftMatchesToRefresh = await db.match.findMany({
      where: {
        id: {
          not: match.id,
        },
      },
      include: {
        selections: {
          select: {
            status: true,
          },
          orderBy: [{ createdAt: "desc" }],
          take: 1,
        },
      },
      orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
    });

    await refreshDraftSelections(
      draftMatchesToRefresh
        .filter((draftMatch) => draftMatch.selections[0]?.status !== SelectionStatus.FINALIZED)
        .map((draftMatch) => draftMatch.id),
    );
  } catch (error) {
    redirect(
      buildPathWithSearch(returnPath, {
        error: error instanceof Error ? error.message : "Could not save the selection.",
        ...(returnPath === `/selection/${matchId}` ? { generated: shouldReturnToGenerated } : {}),
      }),
    );
  }

  revalidatePath(`/selection/${matchId}`);
  if (returnPath !== `/selection/${matchId}`) {
    revalidatePath(returnPath);
  }
  redirect(
    returnPath === `/selection/${matchId}`
      ? buildPathWithSearch(returnPath, {
          saved: status === SelectionStatus.FINALIZED ? "final" : "draft",
          generated: shouldReturnToGenerated,
        })
      : buildPathWithSearch(returnPath, {
          savedMatchId: matchId,
          savedStatus: status === SelectionStatus.FINALIZED ? "final" : "draft",
        }),
  );
}
