import { SelectionRole, SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { canMoveForRole } from "@/lib/selection/rotation-path-policy";
import { formatOverrideReason, toPrismaCategory } from "@/lib/selection/override-reason-utils";
import type { OverrideReasonCategory } from "@/lib/selection/types";

export type MoveResult = {
  success: boolean;
  errors: string[];
  selectionId?: string;
};

export async function movePlannedSelectionWithinRound(input: {
  matchRoundId: string;
  playerId: string;
  fromMatchId: string;
  toMatchId: string;
  targetRole: SelectionRole;
  overrideReasonCategory?: OverrideReasonCategory;
  overrideReasonDetail?: string;
}): Promise<MoveResult> {
  const { matchRoundId, playerId, fromMatchId, toMatchId, targetRole, overrideReasonCategory, overrideReasonDetail } = input;

  if (fromMatchId === toMatchId) {
    return { success: false, errors: ["Source and target match are the same. No move needed."] };
  }

  const round = await db.matchRound.findUnique({
    where: { id: matchRoundId },
    select: { id: true, status: true },
  });

  if (!round) {
    return { success: false, errors: ["Round not found."] };
  }

  if (round.status === "FINALIZED") {
    return { success: false, errors: ["Cannot move a player in a finalized round."] };
  }

  const sourceSelection = await db.selection.findFirst({
    where: {
      matchId: fromMatchId,
      playerId,
      status: SelectionStatus.DRAFT,
    },
    include: {
      match: {
        include: {
          team: { select: { id: true, name: true } },
          matchRound: { select: { id: true, status: true } },
        },
      },
      player: {
        include: { coreTeam: { select: { id: true, name: true } } },
      },
    },
  });

  if (!sourceSelection) {
    return { success: false, errors: ["Player is not assigned to the source match in this round."] };
  }

  if (sourceSelection.match.matchRound.status === "FINALIZED") {
    return { success: false, errors: ["Cannot move a player in a finalized round."] };
  }

  const targetMatch = await db.match.findUnique({
    where: { id: toMatchId },
    include: {
      team: { select: { id: true, name: true, maxSquadSize: true } },
      selections: { where: { status: SelectionStatus.DRAFT }, include: { player: true } },
    },
  });

  if (!targetMatch) {
    return { success: false, errors: ["Target match not found."] };
  }

  const player = sourceSelection.player;

  if (player.removedAt) {
    return { success: false, errors: ["Player has been removed from the active registry."] };
  }

  const existingInTarget = targetMatch.selections.find((s) => s.playerId === playerId);
  if (existingInTarget) {
    return {
      success: false,
      errors: ["A player can have only one planned match opportunity in a round. Move the existing assignment instead of adding another."],
    };
  }

  const sameRoundOtherMatch = await db.selection.findFirst({
    where: {
      matchRoundId,
      playerId,
      status: { in: [SelectionStatus.DRAFT, SelectionStatus.FINALIZED] },
      matchId: { not: fromMatchId },
    },
  });

  if (sameRoundOtherMatch && sameRoundOtherMatch.matchId !== toMatchId) {
    return {
      success: false,
      errors: ["Player has a planned assignment in another match in this round that conflicts with this move."],
    };
  }

  const isCoreRole = targetRole === SelectionRole.CORE;
  let requiresOverride = false;
  const errors: string[] = [];

  if (!isCoreRole && player.nonRotatable && !overrideReasonCategory) {
    return { success: false, errors: ["Non-rotatable player cannot be moved outside core team without override reason."] };
  }

  if (!isCoreRole && player.coreTeamId !== targetMatch.teamId) {
    const activePaths = await db.rotationPath.findMany({
      where: { active: true },
      select: { fromTeamId: true, toTeamId: true, role: true, active: true },
    });

    const pathResult = canMoveForRole(
      player.coreTeamId ?? "",
      targetMatch.teamId,
      targetRole as "SUPPORT" | "DEVELOPMENT" | "BACKFILL",
      player.nonRotatable,
      activePaths,
    );

    if (!pathResult.valid && !overrideReasonCategory) {
      return {
        success: false,
        errors: [`No valid ${targetRole} rotation path from ${player.coreTeam?.name ?? "Unassigned"} to ${targetMatch.team.name}. Override reason required.`],
      };
    }

    if (!pathResult.valid && overrideReasonCategory) {
      requiresOverride = true;
    }
  }

  if (player.currentAvailability !== "AVAILABLE" && player.currentAvailability !== "TENTATIVE" && !overrideReasonCategory) {
    return { success: false, errors: [`Player is ${player.currentAvailability}. Override reason required.`] };
  }
  if (player.currentAvailability !== "AVAILABLE" && player.currentAvailability !== "TENTATIVE" && overrideReasonCategory) {
    requiresOverride = true;
  }

  if (overrideReasonCategory) {
    const { validateOverrideReason } = await import("@/lib/selection/manual-draft-edit");
    const validationErrors = validateOverrideReason(overrideReasonCategory, overrideReasonDetail, requiresOverride);
    if (validationErrors.length > 0) {
      return { success: false, errors: validationErrors };
    }
  }

  const formattedReason = overrideReasonCategory
    ? formatOverrideReason(overrideReasonCategory, overrideReasonDetail)
    : undefined;

  try {
    const result = await db.$transaction(async (tx) => {
      await tx.selection.delete({
        where: { id: sourceSelection.id },
      });

      await tx.movementLedger.deleteMany({
        where: {
          matchId: fromMatchId,
          playerId,
          isDraft: true,
        },
      });

      const newSelection = await tx.selection.create({
        data: {
          matchId: toMatchId,
          matchRoundId,
          playerId,
          role: targetRole,
          status: SelectionStatus.DRAFT,
          overrideReason: formattedReason ?? `Moved from ${sourceSelection.match.team.name}`,
          overrideReasonCategory: overrideReasonCategory ? toPrismaCategory(overrideReasonCategory) : null,
          overrideReasonDetail: overrideReasonDetail ?? null,
          explanation: {
            summary: `Moved from ${sourceSelection.match.team.name} to ${targetMatch.team.name} as ${targetRole}`,
            manuallyAdded: true,
            autoSelected: false,
            sourceTeamName: player.coreTeam?.name ?? "Unassigned",
            targetTeamName: targetMatch.team.name,
          },
        },
      });

      if (player.coreTeamId !== targetMatch.teamId || targetRole !== SelectionRole.CORE) {
        await tx.movementLedger.create({
          data: {
            matchRoundId,
            matchId: toMatchId,
            playerId,
            fromTeamId: player.coreTeamId ?? "",
            toTeamId: targetMatch.teamId,
            role: targetRole,
            isDraft: true,
          },
        });
      }

      return newSelection;
    });

    return { success: true, errors: [], selectionId: result.id };
  } catch (error) {
    return { success: false, errors: [error instanceof Error ? error.message : "Move failed due to a database error."] };
  }
}