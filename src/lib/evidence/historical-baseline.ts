import { db } from "@/lib/db";
import { requireActorContext } from "@/lib/auth/actor-context";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";
import type { RatingAttributeKey } from "@/lib/ratings/player-rating";
import { RATING_ATTRIBUTE_KEYS } from "@/lib/player-development/constants";

export type PlayerRatingBaseline = {
  playerId: string;
  firstName: string;
  lastName: string | null;
  attributes: Record<RatingAttributeKey, number | null>;
  goalkeeperAbility: string;
  capturedAt: Date;
};

export async function captureOrganisationBaselines(
  organisationId: string,
): Promise<{ captured: number; baselineCount: number }> {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);

  if (ctx.organisationId !== organisationId) {
    throw new Error("Organisation access denied");
  }

  const players = await db.player.findMany({
    where: {
      organisationId,
      active: true,
      removedAt: null,
      evidenceCutoverAt: null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      ballControl: true,
      passing: true,
      firstTouch: true,
      oneVOneAttacking: true,
      positioning: true,
      oneVOneDefending: true,
      decisionMaking: true,
      effort: true,
      teamplay: true,
      concentration: true,
      speed: true,
      strength: true,
      goalkeeperAbility: true,
    },
  });

  const now = new Date();
  let captured = 0;

  for (const player of players) {
    await db.player.update({
      where: { id: player.id },
      data: { evidenceCutoverAt: now },
    });
    captured++;
  }

  return { captured, baselineCount: players.length };
}

export async function getPlayerRatingBaseline(
  playerId: string,
): Promise<PlayerRatingBaseline | null> {
  const ctx = await requireActorContext();
  setTenantOrganisationId(ctx.organisationId);

  const player = await db.player.findFirst({
    where: {
      id: playerId,
      organisationId: ctx.organisationId,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      ballControl: true,
      passing: true,
      firstTouch: true,
      oneVOneAttacking: true,
      positioning: true,
      oneVOneDefending: true,
      decisionMaking: true,
      effort: true,
      teamplay: true,
      concentration: true,
      speed: true,
      strength: true,
      goalkeeperAbility: true,
      evidenceCutoverAt: true,
    },
  });

  if (!player) return null;

  const attributes: Record<string, number | null> = {};
  for (const key of RATING_ATTRIBUTE_KEYS) {
    attributes[key] = player[key as keyof typeof player] as number | null;
  }

  return {
    playerId: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    attributes: attributes as Record<RatingAttributeKey, number | null>,
    goalkeeperAbility: player.goalkeeperAbility,
    capturedAt: player.evidenceCutoverAt ?? new Date(),
  };
}