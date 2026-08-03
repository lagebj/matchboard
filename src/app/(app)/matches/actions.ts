'use server'

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireActorContext, requireMutationRole, requireTeamAccess, requirePlayerTeamAccess, requireMatchTeamAccess } from "@/lib/auth/actor-context";
import { buildPathWithSearch } from "@/lib/build-path-with-search";
import { getWeekRange } from "@/lib/date-utils";
import { cleanOpponentDisplayName } from "@/lib/opponents/opponent-team";
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
import {
  cancelMatchDomain,
  reopenMatchDomain,
  checkMatchDeletionGuard,
} from "@/lib/matches/match-domain";
import { logMatchCancel, logMatchReopen, logMatchDelete } from "@/lib/security/audit-log";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

async function requireMatchOrgAccess(matchId: string, orgFilter: OrgFilterMode): Promise<void> {
  if (orgFilter.type !== "org") return;
  const match = await db.match.findFirst({
    where: { id: matchId, ...orgFilter.filter },
    select: { id: true },
  });
  if (!match) throw new Error("Match not found or access denied.");
}

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
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const orgId = ctx.organisationId;
  try {
    const teamId = readNonEmptyString(formData, "teamId", "Team");
    requireTeamAccess(ctx, teamId);
    const opponentText = readText(formData, "opponent");
    const opponentTeamIdInput = readText(formData, "opponentTeamId");
    const startsAt = readDate(formData, "startsAt", "Match date");
    const homeAway = readRequiredEnum(formData, "homeAway", VALID_VENUES, "Home or away");
    const matchType = readRequiredEnum(formData, "matchType", VALID_TYPES, "Match type");
    const gameFormat = readRequiredEnum(formData, "gameFormat", VALID_FORMATS, "Game format");

    const team = await db.team.findFirst({
      where: { id: teamId, archivedAt: null, organisationId: orgId },
      select: { id: true },
    });
    if (!team) throw new Error("Team not found.");

    let opponentTeamId: string | null;
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
      opponentTeamId = null;
      opponent = cleanOpponentDisplayName(opponentText);
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
      matchRoundId = await createFullHierarchy(startsAt, weekStart, weekEnd, orgId);
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
        organisationId: ctx.organisationId,
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

async function createFullHierarchy(startsAt: Date, _weekStart: Date, _weekEnd: Date, organisationId: string): Promise<string> {
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
      data: { name: `${startsAt.getUTCFullYear()} Season`, year: startsAt.getUTCFullYear(), organisationId },
    });
    const period = await db.leagueSeason.create({
      data: { ...periodData, part, seasonId: created.id, organisationId },
    });
    const resolved = await resolveOrCreateMatchRoundForDate({
      leagueSeasonId: period.id,
      startsAt,
    });
    return resolved.roundId;
  }

  const period = await db.leagueSeason.create({
    data: { ...periodData, part, seasonId: season.id, organisationId },
  });
  const resolved = await resolveOrCreateMatchRoundForDate({
    leagueSeasonId: period.id,
    startsAt,
  });
  return resolved.roundId;
}

export async function deleteMatchAction(matchId: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  await requireMatchTeamAccess(ctx, matchId);
  const orgId = ctx.organisationId;
  try {
    const guard = await checkMatchDeletionGuard(matchId, orgId);
    if (!guard.success) throw new Error(guard.error);

    await db.match.delete({ where: { id: guard.matchId } });
    logMatchDelete(ctx.email || "unknown", matchId, "success");
  } catch (error) {
    logMatchDelete(ctx.email || "unknown", matchId, "failure");
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
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  await requireMatchTeamAccess(ctx, matchId);

  try {
    const match = await db.match.findFirst({
      where: { id: matchId, ...(ctx.orgFilter.type === 'org' ? ctx.orgFilter.filter : {}) },
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
  const ctx = await requireActorContext();
  requireMutationRole(ctx);
  const matchId = formData.get("matchId");
  if (typeof matchId !== "string" || !matchId) {
    throw new Error("Match ID is required.");
  }

  await requireMatchOrgAccess(matchId, ctx.orgFilter);
  await requireMatchTeamAccess(ctx, matchId);

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
      queryParams.error = "Override reason required: provide a reason to finalise despite warnings.";
    } else {
      queryParams.error = "Finalisation failed.";
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
  const ctx = await requireActorContext();
  requireMutationRole(ctx);

  await requireMatchOrgAccess(matchId, ctx.orgFilter);
  await requireMatchTeamAccess(ctx, matchId);

  const result = await cancelMatchDomain(matchId, cancelledReason);
  if (!result.success) {
    logMatchCancel(ctx.email || "unknown", matchId, "failure", result.error);
    throw new Error(result.error);
  }

  logMatchCancel(ctx.email || "unknown", matchId, "success", cancelledReason);

  await reconcileRoundAfterDraftMutation(result.matchRoundId);

  revalidatePath("/fixtures");
  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/assistant");
  revalidatePath("/rounds");
}

export async function reopenMatchAction(matchId: string) {
  const ctx = await requireActorContext();
  requireMutationRole(ctx);

  await requireMatchOrgAccess(matchId, ctx.orgFilter);
  await requireMatchTeamAccess(ctx, matchId);

  const result = await reopenMatchDomain(matchId);
  if (!result.success) {
    logMatchReopen(ctx.email || "unknown", matchId, "failure");
    throw new Error(result.error);
  }

  logMatchReopen(ctx.email || "unknown", matchId, "success");

  await reconcileRoundAfterDraftMutation(result.matchRoundId);

  revalidatePath("/fixtures");
  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/assistant");
  revalidatePath("/rounds");
}