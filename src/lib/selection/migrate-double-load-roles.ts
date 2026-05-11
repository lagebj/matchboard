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
): Promise<string> {
  const path = await db.rotationPath.findFirst({
    where: {
      fromTeamId: playerCoreTeamId,
      toTeamId: matchTeamId,
      active: true,
    },
    select: { role: true },
  });

  const validBaseRoles = ["SUPPORT", "DEVELOPMENT", "BACKFILL", "CORE"];

  if (path && validBaseRoles.includes(path.role)) {
    return path.role;
  }

  return "SUPPORT";
}

export async function migrateDoubleLoadRoles(): Promise<MigrateDoubleLoadRolesResult> {
  const doubleLoadSelections = await db.$queryRaw<
    Array<{
      id: string;
      matchRoundId: string;
      matchId: string;
      playerId: string;
      playerCoreTeamId: string;
      matchTeamId: string;
    }>
  >`SELECT s.id, s."matchRoundId", s."matchId", s."playerId", p."coreTeamId" AS "playerCoreTeamId", m."teamId" AS "matchTeamId" FROM "Selection" s JOIN "Player" p ON s."playerId" = p.id JOIN "Match" m ON s."matchId" = m.id WHERE s.role = 'DOUBLE_LOAD'`;

  let rowsMerged = 0;
  let orphansFixed = 0;
  let ledgerRowsUpdated = 0;

  for (const dlSel of doubleLoadSelections) {
    const baseRole = await determineBaseRole(
      dlSel.playerCoreTeamId,
      dlSel.matchTeamId,
    );

    const otherSelection = await db.selection.findFirst({
      where: {
        matchRoundId: dlSel.matchRoundId,
        playerId: dlSel.playerId,
        matchId: { not: dlSel.matchId },
        role: { not: "DOUBLE_LOAD" as unknown as never },
      },
    });

    if (otherSelection) {
      await db.$transaction(async (tx) => {
        await tx.selection.update({
          where: { id: otherSelection.id },
          data: { controlledDoubleLoad: true },
        });

        const ledgerUpdate = await tx.$executeRaw`
          UPDATE "MovementLedger"
          SET role = ${baseRole}, "controlledDoubleLoad" = true
          WHERE "matchRoundId" = ${dlSel.matchRoundId}
            AND "matchId" = ${dlSel.matchId}
            AND "playerId" = ${dlSel.playerId}
            AND role = 'DOUBLE_LOAD'
        `;
        ledgerRowsUpdated += ledgerUpdate;

        await tx.selection.delete({
          where: { id: dlSel.id },
        });
      });

      rowsMerged++;
    } else {
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`
          UPDATE "Selection"
          SET role = ${baseRole}, "controlledDoubleLoad" = true
          WHERE id = ${dlSel.id}
        `;

        const ledgerUpdate = await tx.$executeRaw`
          UPDATE "MovementLedger"
          SET role = ${baseRole}, "controlledDoubleLoad" = true
          WHERE "matchRoundId" = ${dlSel.matchRoundId}
            AND "matchId" = ${dlSel.matchId}
            AND "playerId" = ${dlSel.playerId}
            AND role = 'DOUBLE_LOAD'
        `;
        ledgerRowsUpdated += ledgerUpdate;
      });

      orphansFixed++;
    }
  }

  const remainingLedger = await db.$executeRaw`
    UPDATE "MovementLedger"
    SET role = 'SUPPORT', "controlledDoubleLoad" = true
    WHERE role = 'DOUBLE_LOAD'
  `;
  ledgerRowsUpdated += remainingLedger;

  return {
    rowsProcessed: doubleLoadSelections.length,
    rowsMerged,
    orphansFixed,
    ledgerRowsUpdated,
  };
}