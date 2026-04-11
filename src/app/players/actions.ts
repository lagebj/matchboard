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
import { buildPathWithSearch } from "@/lib/build-path-with-search";
import { playerPositionValues } from "@/lib/player-form-options";

type PlayerInput = {
  active: boolean;
  allowedFloatTeamIds: string[];
  ballControl: number;
  bestSide: BestSide;
  canDropCoreMatch: boolean;
  concentration: number;
  coreTeamId: string;
  currentAvailability: AvailabilityStatus;
  decisionMaking: number;
  effort: number;
  firstName: string;
  firstTouch: number;
  isFloating: boolean;
  lastName: string | null;
  maxDevelopmentMatches: number | null;
  notes: string | null;
  oneVOneAttacking: number;
  oneVOneDefending: number;
  passing: number;
  positioning: number;
  preferredFoot: FootPreference;
  primaryPosition: string;
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

function readOptionalNonNegativeInteger(formData: FormData, fieldName: string, label: string): number | null {
  const value = readText(formData, fieldName);

  if (!value) {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw new Error(`${label} must be empty or a whole number of 0 or more.`);
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
    value === AvailabilityStatus.AWAY
  ) {
    return value;
  }

  throw new Error("Availability must be Available, Injured, Sick, or Away.");
}

async function readCoreTeamId(formData: FormData): Promise<string> {
  const coreTeamId = readText(formData, "coreTeamId");

  if (!coreTeamId) {
    throw new Error("Core team is required.");
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

async function readAllowedFloatTeamIds(formData: FormData, coreTeamId: string): Promise<string[]> {
  const teamIds = [...new Set(formData.getAll("allowedFloatTeamIds"))].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );

  if (teamIds.length === 0) {
    return [];
  }

  const activeTeams = await db.team.findMany({
    where: {
      archivedAt: null,
      id: {
        in: teamIds,
      },
    },
    select: {
      id: true,
    },
  });

  const validTeamIds = activeTeams.map((team) => team.id).filter((teamId) => teamId !== coreTeamId);

  if (validTeamIds.length !== teamIds.filter((teamId) => teamId !== coreTeamId).length) {
    throw new Error("Allowed float teams must reference active teams other than the core team.");
  }

  return validTeamIds;
}

async function readPlayerInput(formData: FormData): Promise<PlayerInput> {
  const firstName = readText(formData, "firstName");
  const primaryPosition = readRequiredPosition(formData, "primaryPosition");
  const coreTeamId = await readCoreTeamId(formData);
  const isFloating = readCheckbox(formData, "isFloating");
  const allowedFloatTeamIds = await readAllowedFloatTeamIds(formData, coreTeamId);

  if (!firstName) {
    throw new Error("First name and primary position are required.");
  }

  return {
    active: readCheckbox(formData, "active"),
    allowedFloatTeamIds,
    ballControl: readRequiredInteger(formData, "ballControl"),
    bestSide: readBestSide(formData),
    canDropCoreMatch: readCheckbox(formData, "canDropCoreMatch"),
    concentration: readRequiredInteger(formData, "concentration"),
    coreTeamId,
    currentAvailability: readAvailabilityStatus(formData),
    decisionMaking: readRequiredInteger(formData, "decisionMaking"),
    effort: readRequiredInteger(formData, "effort"),
    firstName,
    firstTouch: readRequiredInteger(formData, "firstTouch"),
    isFloating,
    lastName: readOptionalText(formData, "lastName"),
    maxDevelopmentMatches: readOptionalNonNegativeInteger(
      formData,
      "maxDevelopmentMatches",
      "Maximum development matches",
    ),
    notes: readOptionalText(formData, "notes"),
    oneVOneAttacking: readRequiredInteger(formData, "oneVOneAttacking"),
    oneVOneDefending: readRequiredInteger(formData, "oneVOneDefending"),
    passing: readRequiredInteger(formData, "passing"),
    positioning: readRequiredInteger(formData, "positioning"),
    preferredFoot: readPreferredFoot(formData),
    primaryPosition,
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

async function createAllowedFloatTeamLinks(
  playerFloatTeam: Pick<typeof db, "playerFloatTeam">["playerFloatTeam"],
  playerId: string,
  allowedFloatTeamIds: string[],
) {
  if (allowedFloatTeamIds.length === 0) {
    return;
  }

  await playerFloatTeam.createMany({
    data: allowedFloatTeamIds.map((teamId) => ({
      playerId,
      teamId,
    })),
  });
}

export async function createPlayerAction(formData: FormData) {
  try {
    const playerInput = await readPlayerInput(formData);
    const { allowedFloatTeamIds, ...playerData } = playerInput;

    await db.$transaction(async (transaction) => {
      const highestPlayerCode = await transaction.player.aggregate({
        _max: {
          playerCode: true,
        },
      });

      const player = await transaction.player.create({
        data: {
          ...playerData,
          playerCode: (highestPlayerCode._max.playerCode ?? 0) + 1,
        },
      });

      await createAllowedFloatTeamLinks(
        transaction.playerFloatTeam,
        player.id,
        allowedFloatTeamIds,
      );
    });
  } catch (error) {
    redirect(
      buildPathWithSearch("/players", {
        create: true,
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
  try {
    const playerInput = await readPlayerInput(formData);
    const { allowedFloatTeamIds, ...playerData } = playerInput;

    await db.$transaction(async (transaction) => {
      const player = await transaction.player.findFirst({
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

      await transaction.player.update({
        where: { id: player.id },
        data: {
          ...playerData,
        },
      });

      await transaction.playerFloatTeam.deleteMany({
        where: {
          playerId: player.id,
        },
      });

      if (allowedFloatTeamIds.length > 0) {
        await transaction.playerFloatTeam.createMany({
          data: allowedFloatTeamIds.map((teamId) => ({
            playerId: player.id,
            teamId,
          })),
        });
      }
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
  try {
    const player = await db.player.findFirst({
      where: {
        id: playerId,
        removedAt: null,
      },
      select: {
        id: true,
        selectionPlayers: {
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

    await db.$transaction(async (transaction) => {
      await transaction.playerFloatTeam.deleteMany({
        where: {
          playerId: player.id,
        },
      });

      if (player.selectionPlayers.length === 0) {
        await transaction.player.delete({
          where: {
            id: player.id,
          },
        });

        return;
      }

      await transaction.player.update({
        where: { id: player.id },
        data: {
          active: false,
          removedAt: new Date(),
        },
      });
    });
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
