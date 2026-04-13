'use server'

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MatchVenue, SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { buildPathWithSearch } from "@/lib/build-path-with-search";
import { formatShortDate, parseDateInputToUtcMidday } from "@/lib/date-utils";
import { matchTypeValues } from "@/lib/player-form-options";
import { refreshDraftSelection, refreshDraftSelections } from "@/lib/selection/refresh-draft-selection";

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

function readMatchType(formData: FormData): string | null {
  const matchType = readOptionalText(formData, "matchType");

  if (!matchType) {
    return null;
  }

  if (matchTypeValues.includes(matchType as (typeof matchTypeValues)[number])) {
    return matchType;
  }

  throw new Error(`Match type must be one of ${matchTypeValues.join(", ")}.`);
}

function readSelectedMatchIds(formData: FormData): string[] {
  return [...new Set(formData.getAll("selectedMatchIds"))].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
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
    targetTeam: {
      name: string;
    };
  },
  reason: string,
) {
  return `${match.targetTeam.name} vs ${match.opponent} on ${formatShortDate(match.startsAt)}: ${reason}`;
}

export async function createMatchAction(formData: FormData) {
  let matchId = "";

  try {
    const startsAt = parseDateInputToUtcMidday(readText(formData, "startsAt"), "Match date");
    const targetTeamId = await readTargetTeamId(formData);
    const homeOrAway = readMatchVenue(formData);
    const opponent = readText(formData, "opponent");
    const squadSize = readRequiredSquadSize(formData, "squadSize");
    const matchType = readMatchType(formData);
    const notes = readOptionalText(formData, "notes");

    if (!opponent) {
      throw new Error("Opponent is required.");
    }

    const match = await db.match.create({
      data: {
        startsAt,
        targetTeamId,
        homeOrAway,
        opponent,
        squadSize,
        matchType,
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

async function finalizeMatches(matchIds?: string[]) {
  const finalizedMatchIds: string[] = [];
  const warnings: string[] = [];

  const matches = await db.match.findMany({
    where: matchIds ? { id: { in: matchIds } } : undefined,
    include: {
      selections: {
        include: {
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
        orderBy: [{ createdAt: "desc" }],
        take: 1,
      },
      targetTeam: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
  });

  for (const match of matches) {
    const latestSelection = match.selections[0] ?? null;

    if (latestSelection?.status === SelectionStatus.FINALIZED) {
      continue;
    }

    if (!latestSelection) {
      warnings.push(formatFinalizeWarning(match, "No saved selection exists yet."));
      continue;
    }

    const activePlayerCount = getActiveSelectionPlayerCount(latestSelection);

    if (activePlayerCount < match.squadSize) {
      warnings.push(
        formatFinalizeWarning(
          match,
          `Selection is ${match.squadSize - activePlayerCount} player(s) short of the ${match.squadSize}-slot squad.`,
        ),
      );
      continue;
    }

    if (activePlayerCount > match.squadSize) {
      warnings.push(
        formatFinalizeWarning(
          match,
          `Selection has ${activePlayerCount} players for a ${match.squadSize}-slot squad.`,
        ),
      );
      continue;
    }

    await db.matchSelection.create({
      data: {
        finalizedAt: new Date(),
        matchId: match.id,
        overrideNotes: latestSelection.overrideNotes,
        players: {
          create: latestSelection.players.map((player) => ({
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
        status: SelectionStatus.FINALIZED,
      },
    });

    finalizedMatchIds.push(match.id);
  }

  return {
    finalizedMatchIds,
    warnings,
  };
}

export async function finalizeMatchesAction(formData: FormData) {
  const selectedMatchIds = readSelectedMatchIds(formData);

  try {
    const { finalizedMatchIds, warnings } = await finalizeMatches(selectedMatchIds);

    revalidatePath("/");
    revalidatePath("/history");
    revalidatePath("/matches");

    for (const matchId of finalizedMatchIds) {
      revalidatePath(`/selection/${matchId}`);
    }

    redirect(
      buildPathWithSearch("/matches", {
        finalizedAll: finalizedMatchIds.length,
        finalizeWarnings: warnings.join("\n"),
      }),
    );
  } catch (error) {
    redirect(
      buildPathWithSearch("/matches", {
        error: error instanceof Error ? error.message : "Could not finalize the selected matches.",
      }),
    );
  }
}

export async function finalizeAllMatchesAction() {
  try {
    const { finalizedMatchIds, warnings } = await finalizeMatches();

    revalidatePath("/");
    revalidatePath("/history");
    revalidatePath("/matches");

    for (const matchId of finalizedMatchIds) {
      revalidatePath(`/selection/${matchId}`);
    }

    redirect(
      buildPathWithSearch("/matches", {
        finalizedAll: finalizedMatchIds.length,
        finalizeWarnings: warnings.join("\n"),
      }),
    );
  } catch (error) {
    redirect(
      buildPathWithSearch("/matches", {
        error: error instanceof Error ? error.message : "Could not finalize all ready matches.",
      }),
    );
  }
}

async function markMatchesAsDraft(matchIds?: string[]) {
  const affectedMatchIds: string[] = [];

  const matches = await db.match.findMany({
    where: matchIds ? { id: { in: matchIds } } : undefined,
    include: {
      selections: {
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
        take: 1,
      },
    },
  });

  for (const match of matches) {
    const latestSelection = match.selections[0] ?? null;

    if (!latestSelection || latestSelection.status === SelectionStatus.DRAFT) {
      continue;
    }

    await db.matchSelection.create({
      data: {
        matchId: match.id,
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

    affectedMatchIds.push(match.id);
  }

  return affectedMatchIds;
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
