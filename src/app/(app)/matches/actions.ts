'use server'

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";
import { buildPathWithSearch } from "@/lib/build-path-with-search";
import { getWeekRange } from "@/lib/date-utils";
import { normalizeOpponentName, cleanOpponentDisplayName } from "@/lib/opponents/opponent-team";
import type { OverrideReasonCategory } from "@/lib/selection/types";
import {
  resolveOrCreateMatchRoundForDate,
  isSameIsoWeek,
  AmbiguousRoundError,
  DateOutsideLeagueSeasonError,
} from "@/lib/matches/resolve-or-create-match-round-for-date";
import {
  getLeagueSeasonPartForDate,
  getLeagueSeasonDateRange,
  formatLeagueSeasonLabel,
} from "@/lib/seasons/league-season";
import { reconcileRoundAfterDraftMutation } from "@/lib/selection/reconcile-integrity";

function readText(formData: FormData, fieldName: string): string {
  const value = formData.get(fieldName);
  if (typeof value !== "string") return "";
  return value.trim();
}

function readNonEmptyString(formData: FormData, fieldName: string, label: string): string {
  const value = readText(formData, fieldName);
  if (!value) throw new Error(`${label} is required.`);
  return value;
}

function readDate(formData: FormData, fieldName: string, label: string): Date {
  const value = readText(formData, fieldName);
  if (!value) throw new Error(`${label} is required.`);
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) throw new Error(`${label} must be a valid date.`);
  return parsed;
}

function readRequiredEnum<T extends string>(
  formData: FormData,
  fieldName: string,
  allowed: readonly T[],
  label: string,
): T {
  const value = readText(formData, fieldName);
  const match = allowed.find((a) => a === value);
  if (!match) throw new Error(`${label} must be one of: ${allowed.join(", ")}`);
  return match;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return "A match with these details already exists.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "Could not save the match.";
}

const VALID_VENUES = ["HOME", "AWAY"] as const;
const VALID_TYPES = ["LEAGUE", "FRIENDLY", "CUP", "DEVELOPMENT"] as const;
const VALID_FORMATS = ["SEVEN_A_SIDE", "NINE_A_SIDE", "ELEVEN_A_SIDE"] as const;

export type MatchFormState = { error: string };

const _INITIAL_STATE: MatchFormState = { error: "" };

export async function createMatchAction(_prevState: MatchFormState, formData: FormData): Promise<MatchFormState> {
  await requireCoachAccess();
  try {
    const teamId = readNonEmptyString(formData, "teamId", "Team");
    const opponentText = readText(formData, "opponent");
    const opponentTeamIdInput = readText(formData, "opponentTeamId");
    const startsAt = readDate(formData, "startsAt", "Match date");
    const homeAway = readRequiredEnum(formData, "homeAway", VALID_VENUES, "Home or away");
    const matchType = readRequiredEnum(formData, "matchType", VALID_TYPES, "Match type");
    const gameFormat = readRequiredEnum(formData, "gameFormat", VALID_FORMATS, "Game format");

    const team = await db.team.findFirst({
      where: { id: teamId, archivedAt: null },
      select: { id: true },
    });
    if (!team) throw new Error("Team not found.");

    let opponentTeamId: string;
    let opponent: string;

    if (opponentTeamIdInput) {
      const existing = await db.opponentTeam.findUnique({
        where: { id: opponentTeamIdInput },
        select: { id: true, displayName: true },
      });
      if (!existing) throw new Error("Opponent team not found.");
      opponentTeamId = existing.id;
      opponent = existing.displayName;
    } else if (opponentText) {
      const displayName = cleanOpponentDisplayName(opponentText);
      const normalizedName = normalizeOpponentName(opponentText);
      const upserted = await db.opponentTeam.upsert({
        where: { normalizedName },
        create: { displayName, normalizedName },
        update: {},
      });
      opponentTeamId = upserted.id;
      opponent = displayName;
    } else {
      throw new Error("Opponent team is required.");
    }

    const { startsAt: weekStart, endsAt: weekEnd } = getWeekRange(startsAt);

    let matchRoundId: string;

    const activeLeagueSeason = await db.leagueSeason.findFirst({
      where: {
        startDate: { lte: weekEnd },
        endDate: { gte: weekStart },
      },
      orderBy: { createdAt: "desc" },
    });

    if (activeLeagueSeason) {
      const resolved = await resolveOrCreateMatchRoundForDate({
        leagueSeasonId: activeLeagueSeason.id,
        startsAt,
      });
      matchRoundId = resolved.roundId;
    } else {
      matchRoundId = await createFullHierarchy(startsAt, weekStart, weekEnd);
    }

    await db.match.create({
      data: {
        teamId,
        opponent,
        opponentTeamId,
        startsAt,
        homeAway,
        matchType,
        gameFormat,
        matchRoundId,
      },
    });
  } catch (error) {
    return { error: getErrorMessage(error) };
  }

  revalidatePath("/fixtures");
  revalidatePath("/rounds");
  revalidatePath("/");
  redirect("/fixtures?saved=created");
}

async function createFullHierarchy(startsAt: Date, _weekStart: Date, _weekEnd: Date): Promise<string> {
  const season = await db.season.findFirst({ orderBy: { createdAt: "desc" } });

  const part = getLeagueSeasonPartForDate(startsAt);
  const dateRange = getLeagueSeasonDateRange(startsAt.getUTCFullYear(), part);
  const name = formatLeagueSeasonLabel({ year: startsAt.getUTCFullYear(), part });

  const periodData = {
    name,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  };

  if (!season) {
    const created = await db.season.create({
      data: { name: `${startsAt.getUTCFullYear()} Season`, year: startsAt.getUTCFullYear() },
    });
    const period = await db.leagueSeason.create({
      data: { ...periodData, part, seasonId: created.id },
    });
    const resolved = await resolveOrCreateMatchRoundForDate({
      leagueSeasonId: period.id,
      startsAt,
    });
    return resolved.roundId;
  }

  const period = await db.leagueSeason.create({
    data: { ...periodData, part, seasonId: season.id },
  });
  const resolved = await resolveOrCreateMatchRoundForDate({
    leagueSeasonId: period.id,
    startsAt,
  });
  return resolved.roundId;
}

export async function deleteMatchAction(matchId: string) {
  await requireCoachAccess();
  try {
    const match = await db.match.findUnique({
      where: { id: matchId },
      select: { id: true, selections: { where: { status: "FINALIZED" }, select: { id: true } } },
    });
    if (!match) throw new Error("Match not found.");
    if (match.selections.length > 0) {
      throw new Error("This match has finalized selections and cannot be removed without explicit confirmation.");
    }

    await db.match.delete({ where: { id: match.id } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete the match.";
    redirect(`/fixtures?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/fixtures");
  revalidatePath("/rounds");
  revalidatePath("/");
  redirect("/fixtures?saved=deleted");
}

export async function updateMatchAction(
  matchId: string,
  startsAt: string,
): Promise<
  | {
      success: true;
      movedRound: boolean;
      createdRound: boolean;
      targetRoundId: string;
      targetRoundName: string;
    }
  | { success: false; error: string }
> {
  await requireCoachAccess();

  try {
    const match = await db.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        startsAt: true,
        matchRoundId: true,
        matchRound: {
          select: {
            id: true,
            name: true,
            leagueSeasonId: true,
            leagueSeason: {
              select: { id: true, startDate: true, endDate: true },
            },
          },
        },
      },
    });

    if (!match) {
      return { success: false, error: "Match not found." };
    }

    const completedReport = await db.postMatchReport.findFirst({
      where: { matchId, status: { in: ["REPORTED", "LOCKED"] } },
      select: { id: true },
    });
    if (completedReport) {
      return { success: false, error: "This match has a completed report. Date changes require a factual correction workflow." };
    }

    const parsedDate = new Date(startsAt);
    if (isNaN(parsedDate.getTime())) {
      return { success: false, error: "Invalid date." };
    }

    const pp = match.matchRound.leagueSeason;
    if (parsedDate < pp.startDate || parsedDate > pp.endDate) {
      return { success: false, error: "This date is outside the current league season. Move the match to a league season covering the new date or update the league season first." };
    }

    const currentRoundId = match.matchRoundId;

    if (isSameIsoWeek(parsedDate, match.startsAt)) {
      await db.match.update({
        where: { id: matchId },
        data: { startsAt: parsedDate },
      });

      revalidatePath("/fixtures");
      revalidatePath(`/matches/${matchId}`);
      revalidatePath(`/rounds/${currentRoundId}`);
      revalidatePath("/assistant");

      return {
        success: true,
        movedRound: false,
        createdRound: false,
        targetRoundId: currentRoundId,
        targetRoundName: match.matchRound.name,
      };
    }

    const hasFinalizedSelection = await db.selection.findFirst({
      where: { matchId, status: "FINALIZED" },
      select: { id: true },
    });

    if (hasFinalizedSelection) {
      return {
        success: false,
        error: "This match has a finalised squad plan. Unfinalise it before moving the match to another round.",
      };
    }

    const leagueSeasonId = match.matchRound.leagueSeasonId;

    const resolved = await resolveOrCreateMatchRoundForDate({
      leagueSeasonId,
      startsAt: parsedDate,
    });

    const targetRoundId = resolved.roundId;

    await db.$transaction(async (tx) => {
      await tx.match.update({
        where: { id: matchId },
        data: {
          startsAt: parsedDate,
          matchRoundId: targetRoundId,
        },
      });

      const draftSelections = await tx.selection.findMany({
        where: {
          matchId,
          matchRoundId: currentRoundId,
          status: "DRAFT",
        },
        select: { id: true },
      });

      if (draftSelections.length > 0) {
        await tx.selection.updateMany({
          where: {
            id: { in: draftSelections.map((s) => s.id) },
          },
          data: { matchRoundId: targetRoundId },
        });
      }

      const draftLedger = await tx.movementLedger.findMany({
        where: {
          matchId,
          matchRoundId: currentRoundId,
          isDraft: true,
        },
        select: { id: true },
      });

      if (draftLedger.length > 0) {
        await tx.movementLedger.updateMany({
          where: {
            id: { in: draftLedger.map((l) => l.id) },
          },
          data: { matchRoundId: targetRoundId },
        });
      }
    });

    if (currentRoundId !== targetRoundId) {
      await reconcileRoundAfterDraftMutation(currentRoundId).catch(() => {});
      await reconcileRoundAfterDraftMutation(targetRoundId).catch(() => {});
    }

    revalidatePath("/fixtures");
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/rounds/${currentRoundId}`);
    revalidatePath(`/rounds/${targetRoundId}`);
    revalidatePath("/assistant");

    return {
      success: true,
      movedRound: true,
      createdRound: resolved.created,
      targetRoundId,
      targetRoundName: resolved.roundName,
    };
  } catch (error) {
    if (error instanceof AmbiguousRoundError) {
      return { success: false, error: error.message };
    }
    if (error instanceof DateOutsideLeagueSeasonError) {
      return { success: false, error: error.message };
    }
    const message = error instanceof Error ? error.message : "Could not update the match.";
    return { success: false, error: message };
  }
}

export async function finalizeMatchAction(formData: FormData) {
  await requireCoachAccess();
  const matchId = formData.get("matchId");
  if (typeof matchId !== "string" || !matchId) {
    throw new Error("Match ID is required.");
  }

  const overrideReasonCategory = formData.get("overrideReasonCategory");
  const overrideReasonDetail = formData.get("overrideReasonDetail");

  const { finalizeSingleMatch } = await import("@/lib/selection/finalize-single-match");
  const { OVERRIDE_REASON_CATEGORIES } = await import("@/lib/selection/types");

  const category = typeof overrideReasonCategory === "string" && OVERRIDE_REASON_CATEGORIES.includes(overrideReasonCategory as OverrideReasonCategory)
    ? (overrideReasonCategory as OverrideReasonCategory)
    : undefined;
  const detail = typeof overrideReasonDetail === "string" && overrideReasonDetail.trim()
    ? overrideReasonDetail.trim()
    : undefined;

  const result = await finalizeSingleMatch(matchId, category, detail);

  if (!result.success) {
    const queryParams: Record<string, string> = {};
    if (result.needsOverride) {
      queryParams.error = "Override reason required: provide a reason to finalize despite warnings.";
    } else {
      queryParams.error = "Finalization failed.";
    }
    redirect(buildPathWithSearch(`/matches/${matchId}`, queryParams));
  }

  revalidatePath("/");
  revalidatePath("/fixtures");
  revalidatePath("/rounds");
  revalidatePath(`/matches/${matchId}`);

  const queryParams: Record<string, string> = { finalized: "1" };
  if (result.roundAutoFinalized) {
    queryParams.roundFinalized = "1";
  }
  redirect(buildPathWithSearch(`/matches/${matchId}`, queryParams));
}

export async function cancelMatchAction(matchId: string, cancelledReason?: string) {
  await requireCoachAccess();

  const match = await db.match.findUnique({
    where: { id: matchId },
    select: { id: true, status: true, matchRoundId: true },
  });

  if (!match) {
    throw new Error("Match not found.");
  }

  if (match.status === "CANCELLED") {
    throw new Error("Match is already cancelled.");
  }

  const existingReport = await db.postMatchReport.findFirst({
    where: {
      matchId,
      status: { in: ["REPORTED", "LOCKED"] },
    },
    select: { id: true },
  });

  if (existingReport) {
    throw new Error("Cannot cancel a match that has a completed post-match report. Resolve the report data conflict first.");
  }

  await db.match.update({
    where: { id: matchId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledReason: cancelledReason?.trim() || null,
    },
  });

  await reconcileRoundAfterDraftMutation(match.matchRoundId);

  revalidatePath("/fixtures");
  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/assistant");
  revalidatePath("/rounds");
}

export async function reopenMatchAction(matchId: string) {
  await requireCoachAccess();

  const match = await db.match.findUnique({
    where: { id: matchId },
    select: { id: true, status: true, matchRoundId: true },
  });

  if (!match) {
    throw new Error("Match not found.");
  }

  if (match.status !== "CANCELLED") {
    throw new Error("Match is not cancelled.");
  }

  await db.match.update({
    where: { id: matchId },
    data: {
      status: "SCHEDULED",
      cancelledAt: null,
      cancelledReason: null,
    },
  });

  await reconcileRoundAfterDraftMutation(match.matchRoundId);

  revalidatePath("/fixtures");
  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/assistant");
  revalidatePath("/rounds");
}