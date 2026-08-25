'use server'

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AvailabilityStatus,
  BestSide,
  FootPreference,
  GoalkeeperAbility,
  Prisma,
  SecondaryFoot,
} from "@/generated/prisma/client";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import { db } from "@/lib/db";
import { requirePageActorContext, requireMutationRole, requireTeamGroupAccess, requirePlayerGroupAccess } from "@/lib/auth/actor-context";
import { buildPathWithSearch } from "@/lib/build-path-with-search";
import { playerPositionValues } from "@/lib/player-form-options";
import {
  togglePlayerActive as togglePlayerActiveDomain,
  removePlayer as removePlayerDomain,
  restorePlayer as restorePlayerDomain,
  setPlayerAvailability as setPlayerAvailabilityDomain,
  updatePlayerCoreTeam as updatePlayerCoreTeamDomain,
} from "@/lib/players/player-domain";
import { logPlayerRemove, logPlayerRestore } from "@/lib/security/audit-log";
import { recordDecision } from "@/domain/assistant-manager/service";

type PlayerInput = {
  active: boolean;
  ballControl: number | null;
  bestSide: BestSide;
  concentration: number | null;
  coreTeamId: string | null;
  currentAvailability: AvailabilityStatus;
  decisionMaking: number | null;
  effort: number | null;
  firstName: string;
  firstTouch: number | null;
  goalkeeperAbility: GoalkeeperAbility;
  lastName: string | null;
  nonRotatable: boolean;
  notes: string | null;
  oneVOneAttacking: number | null;
  oneVOneDefending: number | null;
  passing: number | null;
  positioning: number | null;
  preferredFoot: FootPreference;
  primaryPosition: string;
  reducedMatchLoadAllowed: boolean;
  secondaryFoot: SecondaryFoot;
  secondaryPosition: string | null;
  shirtNumber: number | null;
  speed: number | null;
  strength: number | null;
  teamplay: number | null;
  tertiaryPosition: string | null;
};

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
  return formData.get(fieldName) === "on";
}

function readOptionalRating(formData: FormData, fieldName: string): number | null {
  const value = readText(formData, fieldName);

  if (value === "" || value === "null") {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue < 1 || parsedValue > 10) {
    return null;
  }

  return parsedValue;
}

function readRequiredPosition(formData: FormData, fieldName: string): string {
  const value = readText(formData, fieldName);

  if (playerPositionValues.includes(value as (typeof playerPositionValues)[number])) {
    return value;
  }

  throw new Error(`${fieldName} must be one of ${playerPositionValues.join(", ")}.`);
}

function readOptionalPosition(formData: FormData, fieldName: string): string | null {
  const value = readText(formData, fieldName);

  if (!value) {
    return null;
  }

  if (playerPositionValues.includes(value as (typeof playerPositionValues)[number])) {
    return value;
  }

  throw new Error(`${fieldName} must be empty or one of ${playerPositionValues.join(", ")}.`);
}

function readPreferredFoot(formData: FormData): FootPreference {
  const value = formData.get("preferredFoot");

  if (value === FootPreference.LEFT || value === FootPreference.RIGHT) {
    return value;
  }

  throw new Error("Preferred foot must be Left or Right.");
}

function readSecondaryFoot(formData: FormData): SecondaryFoot {
  const value = formData.get("secondaryFoot");

  if (
    value === SecondaryFoot.LEFT ||
    value === SecondaryFoot.RIGHT ||
    value === SecondaryFoot.WEAK
  ) {
    return value;
  }

  throw new Error("Secondary foot must be Left, Right, or Weak.");
}

function readBestSide(formData: FormData): BestSide {
  const value = formData.get("bestSide");

  if (value === BestSide.LEFT || value === BestSide.CENTER || value === BestSide.RIGHT) {
    return value;
  }

  throw new Error("Best side must be Left, Center, or Right.");
}

function readAvailabilityStatus(formData: FormData): AvailabilityStatus {
  const value = formData.get("currentAvailability");

  if (
    value === AvailabilityStatus.AVAILABLE ||
    value === AvailabilityStatus.UNAVAILABLE ||
    value === AvailabilityStatus.INJURED ||
    value === AvailabilityStatus.SICK ||
    value === AvailabilityStatus.AWAY ||
    value === AvailabilityStatus.TENTATIVE ||
    value === AvailabilityStatus.UNKNOWN
  ) {
    return value;
  }

  throw new Error("Availability must be Available, Unavailable, Injured, Sick, Away, Tentative, or Unknown.");
}

async function readCoreTeamId(formData: FormData, organisationId?: string): Promise<string | null> {
  const coreTeamId = readText(formData, "coreTeamId");

  if (!coreTeamId) {
    return null;
  }

  const team = await db.team.findFirst({
    where: {
      id: coreTeamId,
      archivedAt: null,
      ...(organisationId ? { organisationId } : {}),
    },
    select: {
      id: true,
    },
  });

  if (!team) {
    throw new Error("Core team must be an active team.");
  }

  return team.id;
}

async function readPlayerInput(formData: FormData, organisationId?: string): Promise<PlayerInput> {
  const firstName = readText(formData, "firstName");
  const primaryPosition = readRequiredPosition(formData, "primaryPosition");
  const coreTeamId = await readCoreTeamId(formData, organisationId);

  if (!firstName) {
    throw new Error("First name and primary position are required.");
  }

  return {
    active: readCheckbox(formData, "active"),
    ballControl: readOptionalRating(formData, "ballControl"),
    bestSide: readBestSide(formData),
    concentration: readOptionalRating(formData, "concentration"),
    coreTeamId,
    currentAvailability: readAvailabilityStatus(formData),
    decisionMaking: readOptionalRating(formData, "decisionMaking"),
    effort: readOptionalRating(formData, "effort"),
    firstName,
    firstTouch: readOptionalRating(formData, "firstTouch"),
    goalkeeperAbility: (readText(formData, "goalkeeperAbility") || "NO") as GoalkeeperAbility,
    lastName: readOptionalText(formData, "lastName"),
    nonRotatable: readCheckbox(formData, "nonRotatable"),
    notes: readOptionalText(formData, "notes"),
    oneVOneAttacking: readOptionalRating(formData, "oneVOneAttacking"),
    oneVOneDefending: readOptionalRating(formData, "oneVOneDefending"),
    passing: readOptionalRating(formData, "passing"),
    positioning: readOptionalRating(formData, "positioning"),
    preferredFoot: readPreferredFoot(formData),
    primaryPosition,
    reducedMatchLoadAllowed: readCheckbox(formData, "reducedMatchLoadAllowed"),
    secondaryFoot: readSecondaryFoot(formData),
    secondaryPosition: readOptionalPosition(formData, "secondaryPosition"),
    shirtNumber: readOptionalRating(formData, "shirtNumber"),
    speed: readOptionalRating(formData, "speed"),
    strength: readOptionalRating(formData, "strength"),
    teamplay: readOptionalRating(formData, "teamplay"),
    tertiaryPosition: readOptionalPosition(formData, "tertiaryPosition"),
  };
}

function getPlayerActionErrorMessage(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return "A player with this backend code already exists.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Could not save the player.";
}

export async function createPlayerAction(formData: FormData) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  const organisationId = ctx.organisationId;
  try {
    const playerInput = await readPlayerInput(formData, organisationId);

    let createdPlayerId: string | null = null;
    let attempts = 0;

    while (!createdPlayerId && attempts < 5) {
      attempts++;
      const maxPlayerCode = (await db.player.aggregate({
        where: { organisationId },
        _max: { playerCode: true },
      }))._max.playerCode ?? 0;
      const playerCode = maxPlayerCode + 1;

      try {
        const player = await db.player.create({
          data: {
            ...playerInput,
            playerCode,
            organisationId,
          },
          select: { id: true },
        });
        createdPlayerId = player.id;
      } catch (retryError) {
        if (
          retryError instanceof Prisma.PrismaClientKnownRequestError
          && retryError.code === "P2002"
        ) {
          continue;
        }
        throw retryError;
      }
    }

    if (!createdPlayerId) {
      throw new Error("Could not generate a unique player code after multiple attempts.");
    }
  } catch (error) {
    redirect(
      buildPathWithSearch("/players/new", {
        error: getPlayerActionErrorMessage(error),
      }),
    );
  }

  revalidatePath("/players");
  redirect(
    buildPathWithSearch("/players", {
      saved: "created",
    }),
  );
}

export async function updatePlayerAction(playerId: string, formData: FormData) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  const organisationId = ctx.organisationId;
  try {
    const playerInput = await readPlayerInput(formData, organisationId);

    const player = await db.player.findFirst({
      where: {
        id: playerId,
        removedAt: null,
        ...(organisationId ? { organisationId } : {}),
      },
      select: {
        id: true,
      },
    });

    if (!player) {
      throw new Error("Player not found.");
    }

    await db.player.update({
      where: { id: player.id },
      data: {
        ...playerInput,
      },
    });
  } catch (error) {
    redirect(
      buildPathWithSearch(`/players/${playerId}`, {
        error: getPlayerActionErrorMessage(error),
      }),
    );
  }

  revalidatePath("/players");
  revalidatePath(`/players/${playerId}`);
  redirect(
    buildPathWithSearch(`/players/${playerId}`, {
      saved: "updated",
    }),
  );
}

export async function togglePlayerActiveAction(playerId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  const organisationId = ctx.organisationId;
  const result = await togglePlayerActiveDomain(playerId, organisationId);
  if (!result.success) {
    redirect(buildPathWithSearch("/players", { error: result.error }));
  }

  revalidatePath("/players");
  revalidatePath(`/players/${playerId}`);
  redirect(buildPathWithSearch(`/players/${playerId}`, { saved: "status" }));
}

export async function removePlayerAction(playerId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  const organisationId = ctx.organisationId;
  const result = await removePlayerDomain(playerId, organisationId);
  if (!result.success) {
    logPlayerRemove(ctx.email || "unknown", playerId, "failure", result.error);
    redirect(buildPathWithSearch("/players", { error: result.error }));
  }

  logPlayerRemove(ctx.email || "unknown", playerId, "success");

  revalidatePath("/players");
  revalidatePath("/teams");
  redirect(buildPathWithSearch("/players", { saved: "removed" }));
}

export async function restorePlayerAction(playerId: string) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  const organisationId = ctx.organisationId;
  const result = await restorePlayerDomain(playerId, organisationId);
  if (!result.success) {
    logPlayerRestore(ctx.email || "unknown", playerId, "failure");
    redirect(buildPathWithSearch("/players", { error: result.error }));
  }

  logPlayerRestore(ctx.email || "unknown", playerId, "success");

  revalidatePath("/players");
  revalidatePath("/teams");
  redirect(buildPathWithSearch("/players", { saved: "restored" }));
}

export async function setPlayerAvailabilityAction(formData: FormData) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  const playerId = formData.get("playerId");
  const availability = formData.get("availability");

  if (typeof playerId !== "string" || !playerId) throw new Error("Player ID is required.");
  if (typeof availability !== "string" || !availability) throw new Error("Availability is required.");

  await requirePlayerGroupAccess(ctx, playerId);

  const organisationId = ctx.organisationId;
  const result = await setPlayerAvailabilityDomain(playerId, availability as AvailabilityStatus, organisationId);
  if (!result.success) throw new Error(result.error);

  revalidatePath("/players");
  revalidatePath(`/players/${playerId}`);
  revalidatePath("/rounds");
}

export async function updatePlayerCoreTeamAction(playerId: string, coreTeamId: string | null) {
  const ctx = await requirePageActorContext();
  setTenantOrganisationId(ctx.organisationId);
  requireMutationRole(ctx);
  if (coreTeamId) await requireTeamGroupAccess(ctx, coreTeamId);
  const organisationId = ctx.organisationId;

  const previousPlayer = await db.player.findFirst({
    where: { id: playerId, ...(organisationId ? { organisationId } : {}) },
    select: { coreTeamId: true },
  });

  const result = await updatePlayerCoreTeamDomain(playerId, coreTeamId, organisationId);
  if (!result.success) throw new Error(result.error);

  // Player-development action — AGENTS.md requires a DecisionRecord audit trail here
  // (distinct from logSecurityEvent()'s scope, which is selection-engine actions).
  // See ARR-0022 / ADR-0085's sibling decision (platform-integrity-programme Phase 15).
  await recordDecision({
    decisionType: "PLAYER_ASSIGNMENT",
    entityType: "PLAYER",
    entityId: playerId,
    action: "MOVE_PLAYER_TO_TEAM",
    beforeSnapshot: { coreTeamId: previousPlayer?.coreTeamId ?? null },
    afterSnapshot: { coreTeamId },
    organisationId,
  });

  revalidatePath("/players");
  revalidatePath(`/players/${playerId}`);
  revalidatePath("/teams");
  if (coreTeamId) revalidatePath(`/teams/${coreTeamId}`);
  revalidatePath("/o/[orgSlug]/teams");
  if (coreTeamId) revalidatePath(`/o/[orgSlug]/teams/${coreTeamId}`);
}