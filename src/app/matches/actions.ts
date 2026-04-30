'use server'

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MatchType, MatchVenue, SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { buildPathWithSearch } from "@/lib/build-path-with-search";
import { formatIsoWeekKey, formatShortDate, parseDateInputToUtcMidday } from "@/lib/date-utils";
import { editFinalizedSelection } from "@/lib/selection/edit-finalized-selection";
import { finalizeMatchRound } from "@/lib/selection/finalize-match-round";
import { refreshDraftSelection, refreshDraftSelections } from "@/lib/selection/refresh-draft-selection";
import { ensureMatchRoundIdForDate } from "@/lib/ensure-match-round";

function readText(formData: FormData, fieldName: string): string {
  const value = formData.get(fieldName);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function readOptionalText(formData: FormData, fieldName: string): string | null {
  const value = readText(formData, fieldName);
  return value ? value : null;
}

function readCheckbox(formData: FormData, fieldName: string): boolean {
  const value = formData.get(fieldName);
  return value === "on" || value === "true" || value === "1";
}

async function readTargetTeamId(formData: FormData): Promise<string> {
  const targetTeamId = readText(formData, "targetTeamId");

  if (!targetTeamId) {
    throw new Error("Target team is required.");
  }

  const team = await db.team.findFirst({
    where: {
      id: targetTeamId,
      archivedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (!team) {
    throw new Error("Target team must be an active team.");
  }

  return team.id;
}

function readRequiredSquadSize(formData: FormData, fieldName: string): number {
  const value = readText(formData, fieldName);
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    throw new Error("Squad size must be a whole number greater than 0.");
  }

  return parsedValue;
}

function readMatchType(formData: FormData): MatchType | null {
  const matchType = readOptionalText(formData, "matchType");

  if (!matchType) {
    return null;
  }

  if (Object.values(MatchType).includes(matchType as MatchType)) {
    return matchType as MatchType;
  }

  throw new Error(`Match type must be one of ${Object.values(MatchType).join(", ")}.`);
}

function readSelectedMatchIds(formData: FormData): string[] {
  return [...new Set(formData.getAll("selectedMatchIds"))].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
}

function readReturnPath(formData: FormData, fallbackPath = "/matches"): string {
  const returnPath = readText(formData, "returnPath");

  if (returnPath.startsWith("/")) {
    return returnPath;
  }

  return fallbackPath;
}

function readMatchVenue(formData: FormData): MatchVenue {
  const venue = formData.get("homeOrAway");

  if (venue === MatchVenue.HOME || venue === MatchVenue.AWAY) {
    return venue;
  }

  throw new Error("Home or away status must be Home or Away.");
}

function getActiveSelectionPlayerCount(selection: {
  players: Array<{
    wasManuallyRemoved: boolean;
  }>;
}) {
  return selection.players.filter((player) => !player.wasManuallyRemoved).length;
}

function formatFinalizeWarning(
  match: {
    opponent: string;
    startsAt: Date;
    team: { name: string };
  },
  reason: string,
) {
  return `${match.team.name} vs ${match.opponent} on ${formatShortDate(match.startsAt)}: ${reason}`;
}

type ResetSelectionScope = "all" | "draft" | "match" | "week";

type ResetSelectionResult = {
  deletedSelectionCount: number;
  matchIds: string[];
  weekKeys: string[];
};

async function resetSavedSelections(matchIds?: string[], scope: ResetSelectionScope = "draft"): Promise<ResetSelectionResult> {
  const uniqueMatchIds = [...new Set(matchIds ?? [])];
  const affectedMatches = await db.match.findMany({
    where: uniqueMatchIds.length > 0 ? { id: { in: uniqueMatchIds } } : undefined,
    select: {
      id: true,
      startsAt: true,
    },
  });

  if (uniqueMatchIds.length > 0 && affectedMatches.length === 0) {
    throw new Error("Choose at least one match to reset.");
  }

  const statusFilter = scope === "all"
    ? { status: { in: [SelectionStatus.DRAFT, SelectionStatus.FINALIZED] } }
    : { status: SelectionStatus.DRAFT };

  const deleted = await db.selection.deleteMany({
    where: uniqueMatchIds.length > 0
      ? { matchId: { in: uniqueMatchIds }, ...statusFilter }
      : statusFilter,
  });

  return {
    deletedSelectionCount: deleted.count,
    matchIds: affectedMatches.map((match) => match.id),
    weekKeys: [...new Set(affectedMatches.map((match) => formatIsoWeekKey(match.startsAt)))],
  };
}

function revalidateMatchboardPaths(matchIds: string[], weekKeys: string[]) {
  revalidatePath("/");
  revalidatePath("/history");
  revalidatePath("/matches");
  revalidatePath("/players");
  revalidatePath("/weeks");
  revalidatePath("/rounds");

  for (const weekKey of weekKeys) {
    revalidatePath(`/weeks/${weekKey}`);
  }

  for (const matchId of matchIds) {
    revalidatePath(`/selection/${matchId}`);
  }
}

export async function resetSelectionsAction(formData: FormData) {
  const selectedMatchIds = readSelectedMatchIds(formData);
  const returnPath = readReturnPath(formData);
  const scope = (readText(formData, "resetScope") || "all") as ResetSelectionScope;

  try {
    const { deletedSelectionCount, matchIds, weekKeys } = await resetSavedSelections(
      selectedMatchIds.length > 0 ? selectedMatchIds : undefined,
      scope,
    );

    revalidateMatchboardPaths(matchIds, weekKeys);

    redirect(
      buildPathWithSearch(returnPath, {
        reset: scope,
        resetCount: deletedSelectionCount,
      }),
    );
  } catch (error) {
    redirect(
      buildPathWithSearch(returnPath, {
        error: error instanceof Error ? error.message : "Could not reset the saved selections.",
      }),
    );
  }
}

export async function createMatchAction(formData: FormData) {
  let matchId = "";

  try {
    const startsAt = parseDateInputToUtcMidday(readText(formData, "startsAt"), "Match date");
    const targetTeamId = await readTargetTeamId(formData);
    const homeOrAway = readMatchVenue(formData);
    const opponent = readText(formData, "opponent");
    const squadSize = readRequiredSquadSize(formData, "squadSize");
    const availableForDevelopmentSlot = readCheckbox(formData, "availableForDevelopmentSlot");
    const matchType = readMatchType(formData);
    const notes = readOptionalText(formData, "notes");

    if (!opponent) {
      throw new Error("Opponent is required.");
    }

    const matchRoundId = await ensureMatchRoundIdForDate(startsAt);

    const match = await db.match.create({
      data: {
        startsAt,
        teamId: targetTeamId,
        homeAway: homeOrAway,
        opponent,
        matchRoundId,
        squadSize,
        availableForDevelopmentSlot,
        matchType: matchType ?? undefined,
        notes,
      },
      select: {
        id: true,
      },
    });

    matchId = match.id;
  } catch (error) {
    redirect(
      buildPathWithSearch("/matches", {
        error: error instanceof Error ? error.message : "Could not create the match.",
      }),
    );
  }

  revalidatePath("/matches");
  redirect(
    buildPathWithSearch("/matches", {
      created: matchId,
    }),
  );
}

export async function updateMatchDevelopmentAvailabilityAction(matchId: string, formData: FormData) {
  try {
    const match = await db.match.findUnique({
      where: {
        id: matchId,
      },
      select: {
        id: true,
        startsAt: true,
      },
    });

    if (!match) {
      throw new Error("Match not found.");
    }

    const availableForDevelopmentSlot = readCheckbox(formData, "availableForDevelopmentSlot");

    await db.match.update({
      where: {
        id: match.id,
      },
      data: {
        availableForDevelopmentSlot,
      },
    });

    revalidateMatchboardPaths([match.id], [formatIsoWeekKey(match.startsAt)]);
  } catch (error) {
    redirect(
      buildPathWithSearch("/matches", {
        error:
          error instanceof Error
            ? error.message
            : "Could not update match development availability.",
      }),
    );
  }

  redirect(
    buildPathWithSearch("/matches", {
      saved: "development-availability-updated",
    }),
  );
}

export async function deleteMatchAction(matchId: string) {
  try {
    const match = await db.match.findUnique({
      where: {
        id: matchId,
      },
      select: {
        id: true,
      },
    });

    if (!match) {
      throw new Error("Match not found.");
    }

    await db.match.delete({
      where: {
        id: match.id,
      },
    });
  } catch (error) {
    redirect(
      buildPathWithSearch("/matches", {
        error: error instanceof Error ? error.message : "Could not remove the match.",
      }),
    );
  }

  revalidatePath("/");
  revalidatePath("/matches");
  revalidatePath("/history");
  revalidatePath(`/selection/${matchId}`);
  redirect(
    buildPathWithSearch("/matches", {
      deleted: matchId,
    }),
  );
}

export async function recalculateMatchesAction(formData: FormData) {
  const scope = readText(formData, "scope");
  const selectedMatchIds = readSelectedMatchIds(formData);

  try {
    const matches = await db.match.findMany({
      include: {
        selections: {
          select: {
            id: true,
            status: true,
            createdAt: true,
          },
          orderBy: [{ createdAt: "desc" }],
        },
      },
      orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
    });

    const candidateMatches = matches.filter((match) => {
      const latestSelection = match.selections[0] ?? null;

      if (latestSelection?.status === "FINALIZED") {
        return false;
      }

      if (scope === "all") {
        return true;
      }

      return selectedMatchIds.includes(match.id);
    });

    if (scope !== "all" && candidateMatches.length === 0) {
      throw new Error("Choose at least one draft-eligible match to recalculate.");
    }

    await refreshDraftSelections(candidateMatches.map((match) => match.id));
  } catch (error) {
    redirect(
      buildPathWithSearch("/matches", {
        error: error instanceof Error ? error.message : "Could not recalculate matches.",
      }),
    );
  }

  revalidatePath("/");
  revalidatePath("/history");
  revalidatePath("/matches");
  redirect(
    buildPathWithSearch("/matches", {
      recalculated: scope === "all" ? "all" : "selected",
    }),
  );
}

export async function finalizeMatchRoundAction(matchRoundId: string, overrideReason?: string) {
  try {
    const result = await finalizeMatchRound(matchRoundId, overrideReason);

    const matchIds = result.finalizedMatchIds;
    const weekKeys = await getWeekKeysForMatches(matchIds);
    revalidateMatchboardPaths(matchIds, weekKeys);

    return result;
  } catch (error) {
    return {
      success: false as const,
      warnings: [error instanceof Error ? error.message : "Finalization failed."],
      hardBlocked: true,
      needsOverride: false,
      humanReviewRecommended: false,
      finalizedSelectionCount: 0,
      finalizedMatchIds: [],
    };
  }
}

export async function finalizeMatchesAction(formData: FormData) {
  const selectedMatchIds = readSelectedMatchIds(formData);
  const overrideReason = readOptionalText(formData, "overrideReason");

  if (selectedMatchIds.length === 0) {
    redirect(
      buildPathWithSearch("/matches", {
        error: "Select at least one match to finalize.",
      }),
    );
  }

  const matchRoundId = await getMatchRoundIdForMatches(selectedMatchIds);
  if (!matchRoundId) {
    redirect(
      buildPathWithSearch("/matches", {
        error: "Selected matches do not share a common match round.",
      }),
    );
  }

  const result = await finalizeMatchRound(matchRoundId, overrideReason ?? undefined);

  if (!result.success) {
    const queryParams: Record<string, string> = {};
    if (result.hardBlocked) {
      queryParams.error = "Finalization blocked: resolve hard blockers before finalizing.";
    } else if (result.needsOverride) {
      queryParams.error = "Override reason required: some warnings need a manual override reason.";
    } else {
      queryParams.error = "Finalization failed.";
    }
    if (result.warnings.length > 0) {
      queryParams.finalizeWarnings = result.warnings.join("\n");
    }
    redirect(buildPathWithSearch("/matches", queryParams));
  }

  const weekKeys = await getWeekKeysForMatches(result.finalizedMatchIds);
  revalidateMatchboardPaths(result.finalizedMatchIds, weekKeys);

  redirect(
    buildPathWithSearch("/matches", {
      finalizedAll: String(result.finalizedSelectionCount),
      ...(result.humanReviewRecommended ? { humanReview: "recommended" } : {}),
      ...(result.warnings.length > 0 ? { finalizeWarnings: result.warnings.join("\n") } : {}),
    }),
  );
}

export async function finalizeAllMatchesAction() {
  const latestDraftMatchRound = await db.matchRound.findFirst({
    where: { status: "DRAFT" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!latestDraftMatchRound) {
    redirect(
      buildPathWithSearch("/matches", {
        error: "No draft match round found to finalize.",
      }),
    );
  }

  const result = await finalizeMatchRound(latestDraftMatchRound.id);

  if (!result.success) {
    const queryParams: Record<string, string> = {};
    if (result.hardBlocked) {
      queryParams.error = "Finalization blocked: resolve hard blockers before finalizing.";
    } else if (result.needsOverride) {
      queryParams.error = "Override reason required: some warnings need a manual override reason.";
    } else {
      queryParams.error = "Finalization failed.";
    }
    if (result.warnings.length > 0) {
      queryParams.finalizeWarnings = result.warnings.join("\n");
    }
    redirect(buildPathWithSearch("/matches", queryParams));
  }

  const weekKeys = await getWeekKeysForMatches(result.finalizedMatchIds);
  revalidateMatchboardPaths(result.finalizedMatchIds, weekKeys);

  redirect(
    buildPathWithSearch("/matches", {
      finalizedAll: String(result.finalizedSelectionCount),
      ...(result.humanReviewRecommended ? { humanReview: "recommended" } : {}),
      ...(result.warnings.length > 0 ? { finalizeWarnings: result.warnings.join("\n") } : {}),
    }),
  );
}

async function markMatchesAsDraft(matchIds?: string[]) {
  const where = matchIds && matchIds.length > 0
    ? { matchId: { in: matchIds }, status: SelectionStatus.FINALIZED }
    : { status: SelectionStatus.FINALIZED };

  const result = await db.selection.updateMany({
    where,
    data: { status: SelectionStatus.DRAFT },
  });

  const affected = await db.selection.findMany({
    where: { matchId: { in: matchIds ?? [] }, status: SelectionStatus.DRAFT },
    select: { matchId: true },
    distinct: ["matchId"],
  });

  return affected.map((s) => s.matchId);
}

async function getMatchRoundIdForMatches(matchIds: string[]): Promise<string | null> {
  if (matchIds.length === 0) return null;

  const matches = await db.match.findMany({
    where: { id: { in: matchIds } },
    select: { matchRoundId: true },
  });

  const uniqueMatchRoundIds = [...new Set(matches.map((m) => m.matchRoundId))];
  if (uniqueMatchRoundIds.length !== 1) return null;

  return uniqueMatchRoundIds[0] ?? null;
}

async function getWeekKeysForMatches(matchIds: string[]): Promise<string[]> {
  if (matchIds.length === 0) return [];

  const matches = await db.match.findMany({
    where: { id: { in: matchIds } },
    select: { startsAt: true },
  });

  return [...new Set(matches.map((m) => formatIsoWeekKey(m.startsAt)))];
}

export async function markMatchesAsDraftAction(formData: FormData) {
  const selectedMatchIds = readSelectedMatchIds(formData);

  try {
    const affectedMatchIds = await markMatchesAsDraft(selectedMatchIds);

    revalidatePath("/");
    revalidatePath("/history");
    revalidatePath("/matches");

    for (const matchId of affectedMatchIds) {
      revalidatePath(`/selection/${matchId}`);
    }

    redirect(
      buildPathWithSearch("/matches", {
        markedDraftAll: affectedMatchIds.length,
      }),
    );
  } catch (error) {
    redirect(
      buildPathWithSearch("/matches", {
        error: error instanceof Error ? error.message : "Could not reopen the selected matches.",
      }),
    );
  }
}

export async function markAllMatchesAsDraftAction() {
  try {
    const affectedMatchIds = await markMatchesAsDraft();

    revalidatePath("/");
    revalidatePath("/history");
    revalidatePath("/matches");

    for (const matchId of affectedMatchIds) {
      revalidatePath(`/selection/${matchId}`);
    }

    redirect(
      buildPathWithSearch("/matches", {
        markedDraftAll: affectedMatchIds.length,
      }),
    );
  } catch (error) {
    redirect(
      buildPathWithSearch("/matches", {
        error: error instanceof Error ? error.message : "Could not mark saved selections as draft.",
      }),
    );
  }
}

export async function recalculateMatchAction(matchId: string) {
  try {
    await refreshDraftSelection(matchId);
  } catch (error) {
    redirect(
      buildPathWithSearch(`/selection/${matchId}`, {
        error: error instanceof Error ? error.message : "Could not recalculate this match.",
      }),
    );
  }

  revalidatePath("/");
  revalidatePath("/history");
  revalidatePath("/matches");
  revalidatePath(`/selection/${matchId}`);
  redirect(
    buildPathWithSearch(`/selection/${matchId}`, {
      recalculated: "1",
    }),
  );
}

export async function editFinalizedSelectionAction(
  selectionId: string,
  changeReason: string,
  updatedData: {
    role?: string;
    playerId?: string;
    explanation?: unknown;
  },
) {
  const result = await editFinalizedSelection(selectionId, changeReason, updatedData);

  revalidatePath("/");
  revalidatePath("/history");
  revalidatePath("/matches");

  return result;
}

export async function repairDropoutAction(matchId: string, playerId: string) {
  const { repairDropout } = await import("@/lib/selection/repair-dropout");

  let result;
  try {
    result = await repairDropout(matchId, playerId);
  } catch (error) {
    redirect(
      buildPathWithSearch("/matchday", {
        error: error instanceof Error ? error.message : "Could not repair the dropout.",
      }),
    );
  }

  revalidatePath("/");
  revalidatePath("/matchday");
  revalidatePath(`/selection/${matchId}`);

  if (result.repaired) {
    redirect(
      buildPathWithSearch("/matchday", {
        repaired: "1",
        repairMessage: result.explanation,
      }),
    );
  }

  redirect(
    buildPathWithSearch("/matchday", {
      repairFailed: "1",
      repairMessage: result.explanation,
      repairMatchId: matchId,
      repairPlayerId: playerId,
    }),
  );
}

export async function acceptReducedSquadAction(matchId: string, playerId: string) {
  try {
    const matchingSelection = await db.selection.findFirst({
      where: {
        matchId,
        playerId,
      },
      orderBy: [{ createdAt: "desc" }],
    });

    if (!matchingSelection) {
      throw new Error("Selection record not found for the dropped player.");
    }

    await db.selection.delete({
      where: { id: matchingSelection.id },
    });
  } catch (error) {
    redirect(
      buildPathWithSearch("/matchday", {
        error: error instanceof Error ? error.message : "Could not accept reduced squad.",
      }),
    );
  }

  revalidatePath("/");
  revalidatePath("/matchday");
  revalidatePath(`/selection/${matchId}`);
  redirect(
    buildPathWithSearch("/matchday", {
      repaired: "1",
      repairMessage: "Dropped player removed. Squad accepted at reduced size (below minimum). Manual override recorded.",
    }),
  );
}
