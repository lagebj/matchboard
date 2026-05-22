'use server'

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";
import { buildPathWithSearch } from "@/lib/build-path-with-search";
import { formatIsoWeekKey, formatIsoWeekLabel, getWeekRange } from "@/lib/date-utils";
import { normalizeOpponentName, cleanOpponentDisplayName } from "@/lib/opponents/opponent-team";
import type { OverrideReasonCategory } from "@/lib/selection/types";

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

    const _weekKey = formatIsoWeekKey(startsAt);
    const weekLabel = formatIsoWeekLabel(startsAt);
    const { startsAt: weekStart, endsAt: weekEnd } = getWeekRange(startsAt);

    let matchRound = await db.matchRound.findFirst({
      where: {
        name: { startsWith: weekLabel },
        matches: {
          some: {
            startsAt: {
              gte: weekStart,
              lte: weekEnd,
            },
          },
        },
      },
    });

    if (!matchRound) {
      const activePlanningPeriod = await db.planningPeriod.findFirst({
        where: {
          startDate: { lte: weekEnd },
          endDate: { gte: weekStart },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!activePlanningPeriod) {
        const season = await db.season.findFirst({
          orderBy: { createdAt: "desc" },
        });

        const periodData = {
          name: startsAt.toLocaleString("default", { month: "long", year: "numeric" }),
          startDate: weekStart,
          endDate: new Date(weekStart.getUTCFullYear(), weekStart.getUTCMonth() + 3, 0),
        };

        if (!season) {
          const created = await db.season.create({
            data: { name: `${startsAt.getUTCFullYear()} Season` },
          });
          const period = await db.planningPeriod.create({
            data: { ...periodData, seasonId: created.id },
          });
          matchRound = await db.matchRound.create({
            data: {
              name: weekLabel,
              planningPeriodId: period.id,
              status: "NOT_GENERATED",
            },
          });
        } else {
          const period = await db.planningPeriod.create({
            data: { ...periodData, seasonId: season.id },
          });
          matchRound = await db.matchRound.create({
            data: {
              name: weekLabel,
              planningPeriodId: period.id,
              status: "NOT_GENERATED",
            },
          });
        }
      } else {
        matchRound = await db.matchRound.create({
          data: {
            name: weekLabel,
            planningPeriodId: activePlanningPeriod.id,
            status: "NOT_GENERATED",
          },
        });
      }
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
        matchRoundId: matchRound.id,
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