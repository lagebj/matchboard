import { SelectionRole, SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { loadRotationPathEdgesWithGroupPaths } from "@/lib/selection/load-rotation-paths";
import { isPlayerActiveCandidate } from "@/lib/selection/movement-candidate";
import { canMoveForRole } from "@/lib/selection/rotation-path-policy";
import { formatOverrideReason, toPrismaCategory } from "@/lib/selection/override-reason-utils";
import type { AutomaticSelectionCategory, OverrideReasonCategory } from "@/lib/selection/types";
import { HARD_RULE_OVERRIDE_CATEGORIES, OVERRIDE_REASON_CATEGORIES } from "@/lib/selection/types";

export type ManualEditResult = {
  success: boolean;
  errors: string[];
  warnings: string[];
  selectionId?: string;
};

export type ManualEditValidationError = {
  field: string;
  message: string;
  requiresOverride: boolean;
};

export function validateOverrideReason(
  category: OverrideReasonCategory | undefined,
  detail: string | undefined,
  hardRulesViolated: boolean,
): string[] {
  const errors: string[] = [];

  if (!category) {
    errors.push("Override reason category is required.");
    return errors;
  }

  if (!OVERRIDE_REASON_CATEGORIES.includes(category)) {
    errors.push(`Invalid override reason category: ${category}. Must be one of: ${OVERRIDE_REASON_CATEGORIES.join(", ")}.`);
    return errors;
  }

  if (hardRulesViolated && HARD_RULE_OVERRIDE_CATEGORIES.includes(category) && !detail?.trim()) {
    errors.push(`Detail is required for category "${category}" when overriding a hard rule.`);
  }

  return errors;
}

export async function addPlayerToDraftMatch(
  matchId: string,
  playerId: string,
  role: SelectionRole,
  overrideReasonCategory?: OverrideReasonCategory,
  overrideReasonDetail?: string,
): Promise<ManualEditResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const match = await db.match.findUnique({
    where: { id: matchId },
    include: {
      matchRound: { select: { id: true, status: true } },
      team: { select: { id: true, name: true, maxSquadSize: true } },
      selections: { where: { status: SelectionStatus.DRAFT }, include: { player: true } },
    },
  });

  if (!match) {
    return { success: false, errors: ["Match not found."], warnings };
  }

  if (match.matchRound.status === "FINALIZED") {
    return { success: false, errors: ["Cannot edit a match in a finalised round."], warnings };
  }

  const organisationId = match.organisationId;

  const player = await db.player.findUnique({
    where: { id: playerId },
    include: { coreTeam: { select: { id: true, name: true } } },
  });

  if (!player) {
    return { success: false, errors: ["Player not found."], warnings };
  }

  if (player.removedAt) {
    return { success: false, errors: ["Player has been removed from the active registry."], warnings };
  }

  const isCoreRole = role === SelectionRole.CORE;
  let requiresOverride = false;

  if (!isCoreRole && player.nonRotatable && !overrideReasonCategory) {
    return { success: false, errors: ["Non-rotatable player cannot be moved outside core team without override reason."], warnings };
  }

  if (!isCoreRole && player.coreTeamId !== match.teamId) {
    const activePaths = await loadRotationPathEdgesWithGroupPaths(organisationId, { scope: "MATCH" });

    const pathResult = canMoveForRole(
      player.coreTeamId ?? "",
      match.teamId,
      role as AutomaticSelectionCategory,
      player.nonRotatable,
      activePaths,
    );

    if (!pathResult.valid && !overrideReasonCategory) {
      return {
        success: false,
        errors: [`No valid ${role} rotation path from ${player.coreTeam?.name ?? "Unassigned"} to ${match.team.name}. Override reason required.`],
        warnings,
      };
    }

    if (!pathResult.valid && overrideReasonCategory) {
      requiresOverride = true;
      warnings.push(`Movement override: ${pathResult.explanation}`);
    }

    if (pathResult.valid && pathResult.path) {
      const matchingRotationPath = await db.rotationPath.findFirst({
        where: {
          fromTeamId: pathResult.path.fromTeamId,
          toTeamId: pathResult.path.toTeamId,
          role: pathResult.path.role as SelectionRole,
          active: true,
        },
        select: { id: true },
      });

      if (matchingRotationPath) {
        const candidateRole = role === SelectionRole.SUPPORT ? "SUPPORT" as const : role === SelectionRole.DEVELOPMENT ? "DEVELOPMENT" as const : null;
        if (candidateRole) {
          const isActiveCandidate = await isPlayerActiveCandidate(player.id, matchingRotationPath.id, candidateRole);
          if (!isActiveCandidate) {
            warnings.push("Player is not an active movement candidate for this path. Consider adding them as a movement candidate for better tracking.");
          }
        }
      }
    }
  }

  const existingDraftSelection = match.selections.find((s) => s.playerId === playerId);
  if (existingDraftSelection && !overrideReasonCategory) {
    return { success: false, errors: ["Player already selected for this match in draft. Override reason required."], warnings };
  }
  if (existingDraftSelection && overrideReasonCategory) {
    requiresOverride = true;
    warnings.push("Duplicate selection override: player already selected for this match.");
  }

  const sameRoundSelection = await db.selection.findFirst({
    where: {
      matchRoundId: match.matchRoundId,
      playerId,
      status: { in: [SelectionStatus.DRAFT, SelectionStatus.FINALIZED] },
    },
    select: { id: true, matchId: true, status: true },
  });
  if (sameRoundSelection && sameRoundSelection.matchId !== matchId && !overrideReasonCategory) {
    return { success: false, errors: ["Player already selected for another match in this round. Override reason required."], warnings };
  }
  if (sameRoundSelection && sameRoundSelection.matchId !== matchId && overrideReasonCategory) {
    requiresOverride = true;
    warnings.push("Same-round conflict override: player selected for another match in this round.");
  }

  if (player.currentAvailability !== "AVAILABLE" && player.currentAvailability !== "TENTATIVE" && !overrideReasonCategory) {
    return { success: false, errors: [`Player is ${player.currentAvailability}. Override reason required.`], warnings };
  }
  if (player.currentAvailability !== "AVAILABLE" && player.currentAvailability !== "TENTATIVE" && overrideReasonCategory) {
    requiresOverride = true;
  }
  if (player.currentAvailability === "TENTATIVE") {
    warnings.push("Player availability is tentative.");
  }

  if (match.selections.length >= match.team.maxSquadSize && !overrideReasonCategory) {
    warnings.push(`Squad is at maximum size (${match.team.maxSquadSize}). Adding exceeds maximum.`);
  }

  if (overrideReasonCategory) {
    const validationErrors = validateOverrideReason(overrideReasonCategory, overrideReasonDetail, requiresOverride);
    if (validationErrors.length > 0) {
      return { success: false, errors: validationErrors, warnings };
    }
  }

  const formattedReason = overrideReasonCategory ? formatOverrideReason(overrideReasonCategory, overrideReasonDetail) : null;

  const selection = await db.selection.create({
    data: {
      organisationId,
      matchId,
      matchRoundId: match.matchRoundId,
      playerId,
      role,
      status: SelectionStatus.DRAFT,
      manuallyAdded: true,
      manuallyRemoved: false,
      autoSelected: false,
      sourceTeamName: player.coreTeam?.name ?? "Unassigned",
      targetTeamName: match.team.name,
      selectionReason: `Manually added as ${role}`,
      overrideReason: formattedReason,
      overrideReasonCategory: overrideReasonCategory ? toPrismaCategory(overrideReasonCategory) : null,
      overrideReasonDetail: overrideReasonDetail ?? null,
      explanation: {
        summary: `Manually added as ${role}`,
        manuallyAdded: true,
        autoSelected: false,
        sourceTeamName: player.coreTeam?.name ?? "Unassigned",
        targetTeamName: match.team.name,
      },
    },
  });

  if (player.coreTeamId !== match.teamId || role !== SelectionRole.CORE) {
    await db.movementLedger.create({
      data: {
        organisationId,
        matchRoundId: match.matchRoundId,
        matchId,
        playerId,
        fromTeamId: player.coreTeamId ?? "",
        toTeamId: match.teamId,
        role,
        isDraft: true,
      },
    });
  }

  return { success: true, errors, warnings, selectionId: selection.id };
}

export async function removePlayerFromDraftMatch(
  matchId: string,
  playerId: string,
): Promise<ManualEditResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const selection = await db.selection.findFirst({
    where: {
      matchId,
      playerId,
      status: SelectionStatus.DRAFT,
    },
    include: {
      match: {
        include: {
          matchRound: { select: { id: true, status: true } },
        },
      },
    },
  });

  if (!selection) {
    return { success: false, errors: ["Draft selection not found for this player in this match."], warnings };
  }

  if (selection.match.matchRound.status === "FINALIZED") {
    return { success: false, errors: ["Cannot remove a player from a match in a finalised round."], warnings };
  }

  await db.selection.delete({
    where: { id: selection.id },
  });

  await db.movementLedger.deleteMany({
    where: {
      matchId,
      playerId,
      isDraft: true,
    },
  });

  return { success: true, errors, warnings };
}

export async function changeDraftPlayerRole(
  matchId: string,
  playerId: string,
  newRole: SelectionRole,
  overrideReasonCategory?: OverrideReasonCategory,
  overrideReasonDetail?: string,
): Promise<ManualEditResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const selection = await db.selection.findFirst({
    where: {
      matchId,
      playerId,
      status: SelectionStatus.DRAFT,
    },
    include: {
      match: {
        select: {
          id: true,
          organisationId: true,
          teamId: true,
          matchRound: { select: { id: true, status: true } },
          team: { select: { id: true, name: true } },
        },
      },
      player: {
        include: { coreTeam: { select: { id: true, name: true } } },
      },
    },
  });

  if (!selection) {
    return { success: false, errors: ["Draft selection not found."], warnings };
  }

  if (selection.match.matchRound.status === "FINALIZED") {
    return { success: false, errors: ["Cannot change role in a finalised round."], warnings };
  }

  if (selection.role === newRole) {
    return { success: true, errors, warnings };
  }

  const isCoreRole = newRole === SelectionRole.CORE;
  const player = selection.player;
  let requiresOverride = false;

  if (!isCoreRole && player.coreTeamId !== selection.match.teamId) {
    const activePaths = await loadRotationPathEdgesWithGroupPaths(selection.match.organisationId, { scope: "MATCH" });

    const pathResult = canMoveForRole(
      player.coreTeamId ?? "",
      selection.match.teamId,
      newRole as AutomaticSelectionCategory,
      player.nonRotatable,
      activePaths,
    );

    if (!pathResult.valid && !overrideReasonCategory) {
      return {
        success: false,
        errors: [`No valid ${newRole} rotation path from ${player.coreTeam?.name ?? "Unassigned"} to ${selection.match.team.name}. Override reason required.`],
        warnings,
      };
    }

    if (!pathResult.valid && overrideReasonCategory) {
      requiresOverride = true;
      warnings.push(`Role change override: ${pathResult.explanation}`);
    }
  }

  if (overrideReasonCategory) {
    const validationErrors = validateOverrideReason(overrideReasonCategory, overrideReasonDetail, requiresOverride);
    if (validationErrors.length > 0) {
      return { success: false, errors: validationErrors, warnings };
    }
  }

  const formattedReason = overrideReasonCategory ? formatOverrideReason(overrideReasonCategory, overrideReasonDetail) : selection.overrideReason;

  await db.selection.update({
    where: { id: selection.id },
    data: {
      role: newRole,
      overrideReason: formattedReason,
      overrideReasonCategory: overrideReasonCategory ? toPrismaCategory(overrideReasonCategory) : selection.overrideReasonCategory,
      overrideReasonDetail: overrideReasonDetail ?? selection.overrideReasonDetail,
      autoSelected: false,
      selectionReason: `Role changed from ${selection.role} to ${newRole}`,
      sourceTeamName: player.coreTeam?.name ?? "Unassigned",
      targetTeamName: selection.match.team.name,
      explanation: {
        summary: `Role changed from ${selection.role} to ${newRole}`,
        manuallyAdded: false,
        autoSelected: false,
        sourceTeamName: player.coreTeam?.name ?? "Unassigned",
        targetTeamName: selection.match.team.name,
      },
    },
  });

  await db.movementLedger.deleteMany({
    where: {
      matchId,
      playerId,
      isDraft: true,
    },
  });

  if (player.coreTeamId !== selection.match.teamId || newRole !== SelectionRole.CORE) {
    await db.movementLedger.create({
      data: {
        organisationId: selection.match.organisationId,
        matchRoundId: selection.match.matchRound.id,
        matchId,
        playerId,
        fromTeamId: player.coreTeamId ?? "",
        toTeamId: selection.match.teamId,
        role: newRole,
        isDraft: true,
      },
    });
  }

  return { success: true, errors, warnings, selectionId: selection.id };
}

export async function replaceDraftMatchPlayer(
  matchId: string,
  outgoingPlayerId: string,
  incomingPlayerId: string,
  role: SelectionRole,
  overrideReasonCategory?: OverrideReasonCategory,
  overrideReasonDetail?: string,
): Promise<ManualEditResult> {
  const removeResult = await removePlayerFromDraftMatch(matchId, outgoingPlayerId);
  if (!removeResult.success) {
    return removeResult;
  }

  const addResult = await addPlayerToDraftMatch(matchId, incomingPlayerId, role, overrideReasonCategory, overrideReasonDetail);
  return addResult;
}

export type ValidateManualMatchEditOptions = {
  playerCoreTeamId: string;
  playerCoreTeamName: string;
  targetTeamId: string;
  targetTeamName: string;
  role: SelectionRole;
  nonRotatable: boolean;
  availability: string;
  rotationPaths: { fromTeamId: string; toTeamId: string; role: string; active: boolean }[];
  alreadyInMatch?: boolean;
  alreadyInRound?: boolean;
};

export function validateManualMatchEdit(options: ValidateManualMatchEditOptions): ManualEditValidationError[] {
  const errors: ManualEditValidationError[] = [];
  const { playerCoreTeamId, targetTeamId, role, nonRotatable, availability, rotationPaths, alreadyInMatch, alreadyInRound } = options;

  if (alreadyInMatch) {
    errors.push({
      field: "duplicateMatch",
      message: "Player already selected for this match in draft. Override reason required.",
      requiresOverride: true,
    });
  }

  if (alreadyInRound) {
    errors.push({
      field: "sameRoundConflict",
      message: "Player already selected for another match in this round. Override reason required.",
      requiresOverride: true,
    });
  }

  if (nonRotatable && role !== SelectionRole.CORE) {
    errors.push({
      field: "nonRotatable",
      message: "Non-rotatable player cannot be moved outside core team without override reason.",
      requiresOverride: true,
    });
  }

  if (role !== SelectionRole.CORE && playerCoreTeamId !== targetTeamId) {
    const pathResult = canMoveForRole(
      playerCoreTeamId,
      targetTeamId,
      role as AutomaticSelectionCategory,
      nonRotatable,
      rotationPaths,
    );
    if (!pathResult.valid) {
      errors.push({
        field: "rotationPath",
        message: pathResult.explanation,
        requiresOverride: true,
      });
    }
  }

  if (availability !== "AVAILABLE" && availability !== "TENTATIVE") {
    errors.push({
      field: "availability",
      message: `Player is ${availability}. Override reason required.`,
      requiresOverride: true,
    });
  }

  return errors;
}