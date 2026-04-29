'use server'

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SelectionRole, SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { buildPathWithSearch } from "@/lib/build-path-with-search";
import { generateSelection } from "@/lib/selection/generate-selection";
import { refreshDraftSelections } from "@/lib/selection/refresh-draft-selection";
import { createGeneratedDraftSelection } from "@/lib/selection/save-generated-draft";

type SelectionExplanation = {
  autoSelected?: boolean;
  chosenPosition?: string | null;
  manuallyAdded?: boolean;
  manuallyRemoved?: boolean;
  sourceTeamName?: string;
  summary?: string;
  targetTeamName?: string;
};

type SelectionPlayerWriteInput = {
  explanation: string;
  matchRoundId: string;
  overrideReason?: string;
  playerId: string;
  role: SelectionRole;
  sourceTeamName: string;
  targetTeamName: string;
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
    value === SelectionRole.SUPPORT ||
    value === SelectionRole.MANUAL_OVERRIDE
  ) {
    return value;
  }

  return SelectionRole.MANUAL_OVERRIDE;
}

function getSelectionRoleFromCategory(category: string): SelectionRole {
  if (
    category === SelectionRole.CORE ||
    category === SelectionRole.SUPPORT ||
    category === SelectionRole.DEVELOPMENT
  ) {
    return category;
  }

  return SelectionRole.MANUAL_OVERRIDE;
}

async function createSelectionRecords(
  matchId: string,
  matchRoundId: string,
  status: SelectionStatus,
  players: SelectionPlayerWriteInput[],
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

  await db.$transaction(
    players.map((player) =>
      db.selection.create({
        data: {
          matchId: match.id,
          matchRoundId,
          overrideReason: player.overrideReason ?? null,
          playerId: player.playerId,
          role: player.role,
          status,
          explanation: {
            summary: player.explanation,
            autoSelected: player.wasAutoSelected,
            manuallyAdded: player.wasManuallyAdded,
            manuallyRemoved: player.wasManuallyRemoved,
            sourceTeamName: player.sourceTeamName,
            targetTeamName: player.targetTeamName,
          },
        },
      }),
    ),
  );
}

async function getBaselineSelectionRows(
  matchId: string,
  targetTeamName: string,
  formData: FormData,
): Promise<BaselineSelectionRow[]> {
  const baselineSelectionMatchId = readText(formData, "baselineSelectionMatchId");

  if (baselineSelectionMatchId) {
    const baselineSelections = await db.selection.findMany({
      where: {
        matchId: baselineSelectionMatchId,
      },
      select: {
        matchRoundId: true,
        playerId: true,
        role: true,
        explanation: true,
      },
    });

    if (baselineSelections.length > 0) {
      const matchRoundId = baselineSelections[0]!.matchRoundId;

      return baselineSelections.map((selection) => {
        const explanation = (selection.explanation ?? {}) as SelectionExplanation;
        return {
          explanation: explanation.summary ?? "",
          matchRoundId,
          playerId: selection.playerId,
          role: selection.role,
          sourceTeamName: explanation.sourceTeamName ?? "",
          targetTeamName: explanation.targetTeamName || targetTeamName,
          wasAutoSelected: explanation.autoSelected ?? false,
          wasManuallyAdded: explanation.manuallyAdded ?? false,
          wasManuallyRemoved: explanation.manuallyRemoved ?? false,
        };
      });
    }
  }

  const generatedPlayerIds = [...new Set(formData.getAll("generatedBaselinePlayerIds"))].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );

  return generatedPlayerIds.map((playerId) => ({
    explanation: readText(formData, `generatedBaselineExplanation:${playerId}`),
    matchRoundId: "__generated__",
    playerId,
    role: getSelectionRoleFromCategory(
      readText(formData, `generatedBaselineRoleType:${playerId}`),
    ),
    sourceTeamName: readText(formData, `generatedBaselineSourceTeam:${playerId}`),
    targetTeamName,
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
    const selectedPlayerIds = [...new Set(formData.getAll("selectedPlayerIds"))].filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );

    const match = await db.match.findUnique({
      where: { id: matchId },
      include: {
        team: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!match) {
      throw new Error("Match not found.");
    }

    const baselineRows = await getBaselineSelectionRows(match.id, match.team.name, formData);
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

    const matchRoundId = match.matchRoundId;

    const selectionPlayers: SelectionPlayerWriteInput[] = selectedPlayers.map((player) => {
      const baselineRow = baselineRowByPlayerId.get(player.id);
      const role = readSelectionRole(formData, player.id);
      const overrideReason = role === SelectionRole.MANUAL_OVERRIDE
        ? readText(formData, `overrideReason:${player.id}`) || undefined
        : undefined;

      if (!baselineRow) {
        return {
          explanation: buildManualAddExplanation(false),
          matchRoundId,
          overrideReason,
          playerId: player.id,
          role,
          sourceTeamName: player.coreTeam.name,
          targetTeamName: match.team.name,
          wasAutoSelected: false,
          wasManuallyAdded: true,
          wasManuallyRemoved: false,
        };
      }

      if (baselineRow.wasManuallyRemoved) {
        return {
          explanation: buildManualAddExplanation(true),
          matchRoundId,
          overrideReason,
          playerId: player.id,
          role,
          sourceTeamName: baselineRow.sourceTeamName,
          targetTeamName: baselineRow.targetTeamName,
          wasAutoSelected: baselineRow.wasAutoSelected,
          wasManuallyAdded: true,
          wasManuallyRemoved: false,
        };
      }

      return {
        explanation: baselineRow.explanation,
        matchRoundId,
        overrideReason,
        playerId: player.id,
        role,
        sourceTeamName: baselineRow.sourceTeamName,
        targetTeamName: baselineRow.targetTeamName,
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
        matchRoundId,
        playerId: baselineRow.playerId,
        role: baselineRow.role,
        sourceTeamName: baselineRow.sourceTeamName,
        targetTeamName: baselineRow.targetTeamName,
        wasAutoSelected: baselineRow.wasAutoSelected,
        wasManuallyAdded: baselineRow.wasManuallyAdded,
        wasManuallyRemoved: true,
      });
    }

    const activeSelectionPlayerIds = selectionPlayers
      .filter((p) => !p.wasManuallyRemoved)
      .map((p) => p.playerId);
    const duplicatePlayerIds = activeSelectionPlayerIds.filter(
      (playerId, index) => activeSelectionPlayerIds.indexOf(playerId) !== index,
    );

    if (duplicatePlayerIds.length > 0) {
      const duplicatePlayers = selectedPlayers.filter((p) =>
        duplicatePlayerIds.includes(p.id),
      );
      const duplicateNames = duplicatePlayers
        .map((p) => `${p.firstName}${p.lastName ? ` ${p.lastName}` : ""}`)
        .join(", ");
      throw new Error(
        `A player can only be selected once per match round. Duplicate selection: ${duplicateNames}.`,
      );
    }

    const manualOverridePlayers = selectionPlayers.filter(
      (p) => p.role === SelectionRole.MANUAL_OVERRIDE && !p.wasManuallyRemoved,
    );

    for (const overridePlayer of manualOverridePlayers) {
      const overrideReason = readText(formData, `overrideReason:${overridePlayer.playerId}`);
      if (!overrideReason) {
        const player = selectedPlayers.find((p) => p.id === overridePlayer.playerId);
        const playerName = player
          ? `${player.firstName}${player.lastName ? ` ${player.lastName}` : ""}`
          : overridePlayer.playerId;
        throw new Error(
          `Manual override for ${playerName} requires a reason category. Please provide a reason for this override.`,
        );
      }
    }

    await createSelectionRecords(
      match.id,
      matchRoundId,
      status,
      selectionPlayers,
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