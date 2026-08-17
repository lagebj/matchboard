import { db } from '@/lib/db';
import { PlayerPositionPriority } from '@/generated/prisma/client';

type PositionInput = {
  playerId: string;
  primaryPosition: string;
  secondaryPosition: string | null;
  tertiaryPosition: string | null;
};

export async function syncPlayerPositions(input: PositionInput): Promise<void> {
  const { playerId, primaryPosition, secondaryPosition, tertiaryPosition } = input;

  const player = await db.player.findFirst({ where: { id: playerId }, select: { organisationId: true } });
  const organisationId = player?.organisationId ?? "";

  const entries: { positionId: string; priority: PlayerPositionPriority }[] = [];

  entries.push({ positionId: primaryPosition, priority: 'PRIMARY' });

  if (secondaryPosition && secondaryPosition !== 'NONE') {
    entries.push({ positionId: secondaryPosition, priority: 'SECONDARY' });
  }

  if (tertiaryPosition && tertiaryPosition !== 'NONE') {
    entries.push({ positionId: tertiaryPosition, priority: 'TERTIARY' });
  }

  await db.$transaction(async (tx) => {
    await tx.playerPosition.deleteMany({
      where: { playerId },
    });

    if (entries.length > 0) {
      await tx.playerPosition.createMany({
        data: entries.map((e) => ({
          organisationId,
          playerId,
          positionId: e.positionId,
          priority: e.priority,
        })),
      });
    }
  });
}