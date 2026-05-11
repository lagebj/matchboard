import { SelectionRole } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export type MigrateSquadRepairRolesResult = {
  rowsUpdated: number;
  ledgerRowsUpdated: number;
};

function explanationContainsSquadRepair(explanation: unknown): boolean {
  if (explanation === null || explanation === undefined) return false;

  if (typeof explanation === "string") {
    return explanation.toLowerCase().includes("squad repair");
  }

  if (typeof explanation === "object") {
    const str = JSON.stringify(explanation).toLowerCase();
    return str.includes("squad repair");
  }

  return false;
}

export async function migrateSquadRepairRoles(): Promise<MigrateSquadRepairRolesResult> {
  const candidateSelections = await db.selection.findMany({
    where: { role: SelectionRole.CORE },
    include: {
      player: { select: { id: true } },
      match: { select: { id: true } },
    },
  });

  const toMigrate = candidateSelections.filter((s) =>
    explanationContainsSquadRepair(s.explanation),
  );

  let rowsUpdated = 0;
  let ledgerRowsUpdated = 0;

  for (const sel of toMigrate) {
    await db.$transaction(async (tx) => {
      await tx.selection.update({
        where: { id: sel.id },
        data: { role: SelectionRole.BACKFILL },
      });

      rowsUpdated++;

      const ledgerResult = await tx.movementLedger.updateMany({
        where: {
          matchId: sel.matchId,
          matchRoundId: sel.matchRoundId,
          playerId: sel.playerId,
          role: SelectionRole.CORE,
        },
        data: { role: SelectionRole.BACKFILL },
      });

      ledgerRowsUpdated += ledgerResult.count;
    });
  }

  return {
    rowsUpdated,
    ledgerRowsUpdated,
  };
}