import { SelectionRole, SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export type BackfillMovementLedgerResult = {
  entriesCreated: number;
  selectionsChecked: number;
  coreSkipped: number;
};

export async function backfillMovementLedger(): Promise<BackfillMovementLedgerResult> {
  const nonCoreSelections = await db.selection.findMany({
    where: {
      OR: [
        { role: { not: SelectionRole.CORE } },
        { controlledDoubleLoad: true },
      ],
    },
    include: {
      player: { select: { coreTeamId: true } },
      match: { select: { teamId: true } },
    },
  });

  const coreNonCoreTeamSelections = await db.selection.findMany({
    where: {
      role: SelectionRole.CORE,
      controlledDoubleLoad: false,
    },
    include: {
      player: { select: { coreTeamId: true } },
      match: { select: { teamId: true } },
    },
  });

  const allSelections = [...nonCoreSelections, ...coreNonCoreTeamSelections];

  let entriesCreated = 0;
  let selectionsChecked = 0;
  let coreSkipped = 0;

  for (const sel of allSelections) {
    const isCoreOnOwnTeam =
      sel.role === SelectionRole.CORE &&
      sel.player.coreTeamId === sel.match.teamId &&
      !sel.controlledDoubleLoad;

    if (isCoreOnOwnTeam) {
      coreSkipped++;
      selectionsChecked++;
      continue;
    }

    const existing = await db.movementLedger.findFirst({
      where: {
        matchRoundId: sel.matchRoundId,
        matchId: sel.matchId,
        playerId: sel.playerId,
      },
    });

    if (!existing) {
      await db.movementLedger.create({
        data: {
          matchRoundId: sel.matchRoundId,
          matchId: sel.matchId,
          playerId: sel.playerId,
          fromTeamId: sel.player.coreTeamId ?? "unknown",
          toTeamId: sel.match.teamId,
          role: sel.role as SelectionRole,
          controlledDoubleLoad: sel.controlledDoubleLoad ?? false,
          isDraft: sel.status === SelectionStatus.DRAFT,
        },
      });

      entriesCreated++;
    }

    selectionsChecked++;
  }

  return {
    entriesCreated,
    selectionsChecked,
    coreSkipped,
  };
}