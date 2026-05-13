'use server'

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AvailabilityStatus,
  BestSide,
  FootPreference,
  Prisma,
  SecondaryFoot,
} from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireCoachAccess } from "@/lib/auth";
import { buildPathWithSearch } from "@/lib/build-path-with-search";
import { playerPositionValues } from "@/lib/player-form-options";

type PlayerInput = {
  active: boolean;
  ballControl: number;
  bestSide: BestSide;
  concentration: number;
  coreTeamId: string | null;
  currentAvailability: AvailabilityStatus;
  decisionMaking: number;
  effort: number;
  firstName: string;
  firstTouch: number;
  lastName: string | null;
  nonRotatable: boolean;
  notes: string | null;
  oneVOneAttacking: number;
  oneVOneDefending: number;
  passing: number;
  positioning: number;
  preferredFoot: FootPreference;
  primaryPosition: string;
  reducedMatchLoadAllowed: boolean;
  secondaryFoot: SecondaryFoot;
  secondaryPosition: string | null;
  speed: number;
  strength: number;
  teamplay: number;
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

function readRequiredInteger(formData: FormData, fieldName: string): number {
  const value = readText(formData, fieldName);
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue < 1 || parsedValue > 5) {
    throw new Error(`${fieldName} must be a whole number between 1 and 5.`);
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
    value === AvailabilityStatus.INJURED ||
    value === AvailabilityStatus.SICK ||
    value === AvailabilityStatus.AWAY ||
    value === AvailabilityStatus.TENTATIVE ||
    value === AvailabilityStatus.UNKNOWN
  ) {
    return value;
  }

  throw new Error("Availability must be Available, Injured, Sick, Away, Tentative, or Unknown.");
}

async function readCoreTeamId(formData: FormData): Promise<string | null> {
  const coreTeamId = readText(formData, "coreTeamId");

  if (!coreTeamId) {
    return null;
  }

  const team = await db.team.findFirst({
    where: {
      id: coreTeamId,
      archivedAt: null,
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

async function readPlayerInput(formData: FormData): Promise<PlayerInput> {
  const firstName = readText(formData, "firstName");
  const primaryPosition = readRequiredPosition(formData, "primaryPosition");
  const coreTeamId = await readCoreTeamId(formData);

  if (!firstName) {
    throw new Error("First name and primary position are required.");
  }

  return {
    active: readCheckbox(formData, "active"),
    ballControl: readRequiredInteger(formData, "ballControl"),
    bestSide: readBestSide(formData),
    concentration: readRequiredInteger(formData, "concentration"),
    coreTeamId,
    currentAvailability: readAvailabilityStatus(formData),
    decisionMaking: readRequiredInteger(formData, "decisionMaking"),
    effort: readRequiredInteger(formData, "effort"),
    firstName,
    firstTouch: readRequiredInteger(formData, "firstTouch"),
    lastName: readOptionalText(formData, "lastName"),
    nonRotatable: readCheckbox(formData, "nonRotatable"),
    notes: readOptionalText(formData, "notes"),
    oneVOneAttacking: readRequiredInteger(formData, "oneVOneAttacking"),
    oneVOneDefending: readRequiredInteger(formData, "oneVOneDefending"),
    passing: readRequiredInteger(formData, "passing"),
    positioning: readRequiredInteger(formData, "positioning"),
    preferredFoot: readPreferredFoot(formData),
    primaryPosition,
    reducedMatchLoadAllowed: readCheckbox(formData, "reducedMatchLoadAllowed"),
    secondaryFoot: readSecondaryFoot(formData),
    secondaryPosition: readOptionalPosition(formData, "secondaryPosition"),
    speed: readRequiredInteger(formData, "speed"),
    strength: readRequiredInteger(formData, "strength"),
    teamplay: readRequiredInteger(formData, "teamplay"),
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
  await requireCoachAccess();
  try {
    const playerInput = await readPlayerInput(formData);

    let created = false;
    let attempts = 0;

    while (!created && attempts < 5) {
      attempts++;
      const maxPlayerCode = (await db.player.aggregate({ _max: { playerCode: true } }))._max.playerCode ?? 0;
      const playerCode = maxPlayerCode + 1;

      try {
        await db.player.create({
          data: {
            ...playerInput,
            playerCode,
          },
        });
        created = true;
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

    if (!created) {
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
  await requireCoachAccess();
  try {
    const playerInput = await readPlayerInput(formData);

    const player = await db.player.findFirst({
      where: {
        id: playerId,
        removedAt: null,
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
  await requireCoachAccess();
  try {
    const player = await db.player.findFirst({
      where: {
        id: playerId,
        removedAt: null,
      },
      select: {
        active: true,
        id: true,
      },
    });

    if (!player) {
      throw new Error("Player not found.");
    }

    await db.player.update({
      where: { id: player.id },
      data: {
        active: !player.active,
      },
    });
  } catch (error) {
    redirect(
      buildPathWithSearch("/players", {
        error: getPlayerActionErrorMessage(error),
      }),
    );
  }

  revalidatePath("/players");
  revalidatePath(`/players/${playerId}`);
  redirect(
    buildPathWithSearch(`/players/${playerId}`, {
      saved: "status",
    }),
  );
}

export async function removePlayerAction(playerId: string) {
  await requireCoachAccess();
  try {
    const player = await db.player.findFirst({
      where: {
        id: playerId,
        removedAt: null,
      },
      select: {
        id: true,
        selections: {
          select: {
            id: true,
          },
          take: 1,
        },
      },
    });

    if (!player) {
      throw new Error("Player not found.");
    }

    if (player.selections.length === 0) {
      await db.player.delete({
        where: {
          id: player.id,
        },
      });
    } else {
      await db.player.update({
        where: { id: player.id },
        data: {
          active: false,
          removedAt: new Date(),
        },
      });
    }
  } catch (error) {
    redirect(
      buildPathWithSearch("/players", {
        error: getPlayerActionErrorMessage(error),
      }),
    );
  }

  revalidatePath("/players");
  revalidatePath("/teams");
  redirect(
    buildPathWithSearch("/players", {
      saved: "removed",
    }),
  );
}

export async function setPlayerAvailabilityAction(formData: FormData) {
  await requireCoachAccess();
  const playerId = formData.get("playerId");
  const availability = formData.get("availability");

  if (typeof playerId !== "string" || !playerId) throw new Error("Player ID is required.");
  if (typeof availability !== "string" || !availability) throw new Error("Availability is required.");

  const validStatuses: AvailabilityStatus[] = ["AVAILABLE", "INJURED", "SICK", "AWAY", "TENTATIVE", "UNKNOWN"];
  if (!validStatuses.includes(availability as AvailabilityStatus)) {
    throw new Error(`Invalid availability status: ${availability}`);
  }

  const player = await db.player.findFirst({
    where: { id: playerId, removedAt: null },
    select: { id: true },
  });

  if (!player) throw new Error("Player not found.");

  await db.player.update({
    where: { id: player.id },
    data: { currentAvailability: availability as AvailabilityStatus },
  });

  revalidatePath("/players");
  revalidatePath(`/players/${playerId}`);
  revalidatePath("/rounds");
}