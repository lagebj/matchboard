import { SelectionRole } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export type MigrateDoubleLoadRolesResult = {
  rowsProcessed: number;
  rowsMerged: number;
  orphansFixed: number;
  ledgerRowsUpdated: number;
};

async function determineBaseRole(
  playerCoreTeamId: string,
  matchTeamId: string,
): Promise<SelectionRole> {
  const path = await db.rotationPath.findFirst({
    where: {
      fromTeamId: playerCoreTeamId,
      toTeamId: matchTeamId,
      active: true,
    },
    select: { role: true },
  });

  const validBaseRoles: SelectionRole[] = [
    SelectionRole.SUPPORT,
    SelectionRole.DEVELOPMENT,
    SelectionRole.BACKFILL,
    SelectionRole.CORE,
  ];

  if (path && validBaseRoles.includes(path.role as SelectionRole)) {
    return path.role as SelectionRole;
  }

  return SelectionRole.SUPPORT;
}

export async function migrateDoubleLoadRoles(): Promise<MigrateDoubleLoadRolesResult> {
  const doubleLoadSelections = await db.selection.findMany({
    where: { role: SelectionRole.DOUBLE_LOAD },
    include: {
      player: { select: { coreTeamId: true } },
      match: { select: { teamId: true } },
    },
  });

  let rowsMerged = 0;
  let orphansFixed = 0;
  let ledgerRowsUpdated = 0;

  for (const dlSel of doubleLoadSelections) {
    const baseRole = await determineBaseRole(
      dlSel.player.coreTeamId,
      dlSel.match.teamId,
    );

    const otherSelection = await db.selection.findFirst({
      where: {
        matchRoundId: dlSel.matchRoundId,
        playerId: dlSel.playerId,
        matchId: { not: dlSel.matchId },
        role: { not: SelectionRole.DOUBLE_LOAD },
      },
    });

    if (otherSelection) {
      await db.$transaction(async (tx) => {
        await tx.selection.update({
          where: { id: otherSelection.id },
          data: { controlledDoubleLoad: true },
        });

        const ledgerUpdate = await tx.movementLedger.updateMany({
          where: {
            matchRoundId: dlSel.matchRoundId,
            matchId: dlSel.matchId,
            playerId: dlSel.playerId,
            role: SelectionRole.DOUBLE_LOAD,
          },
          data: {
            role: baseRole,
            controlledDoubleLoad: true,
          },
        });
        ledgerRowsUpdated += ledgerUpdate.count;

        await tx.selection.delete({
          where: { id: dlSel.id },
        });
      });

      rowsMerged++;
    } else {
      await db.$transaction(async (tx) => {
        await tx.selection.update({
          where: { id: dlSel.id },
          data: {
            role: baseRole,
            controlledDoubleLoad: true,
          },
        });

        const ledgerUpdate = await tx.movementLedger.updateMany({
          where: {
            matchRoundId: dlSel.matchRoundId,
            matchId: dlSel.matchId,
            playerId: dlSel.playerId,
            role: SelectionRole.DOUBLE_LOAD,
          },
          data: {
            role: baseRole,
            controlledDoubleLoad: true,
          },
        });
        ledgerRowsUpdated += ledgerUpdate.count;
      });

      orphansFixed++;
    }
  }

  const remainingLedger = await db.movementLedger.updateMany({
    where: { role: SelectionRole.DOUBLE_LOAD },
    data: {
      role: SelectionRole.SUPPORT,
      controlledDoubleLoad: true,
    },
  });
  ledgerRowsUpdated += remainingLedger.count;

  return {
    rowsProcessed: doubleLoadSelections.length,
    rowsMerged,
    orphansFixed,
    ledgerRowsUpdated,
  };
}