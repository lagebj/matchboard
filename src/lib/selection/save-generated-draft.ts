import { SelectionRole, SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { GeneratedRound, GeneratedSelection, SelectedPlayer } from "@/lib/selection/types";

// Maps in-memory selection categories to Prisma SelectionRole enum values.
// BACKFILL and CONFIDENCE_REBUILD are legacy roles retained for backward
// compatibility with historical data and manual overrides. New generation
// only produces CORE, SUPPORT, and DEVELOPMENT.
function mapSelectionCategoryToRole(category: string): SelectionRole {
  if (category === "CORE") return SelectionRole.CORE;
  if (category === "SUPPORT") return SelectionRole.SUPPORT;
  if (category === "DEVELOPMENT") return SelectionRole.DEVELOPMENT;
  if (category === "BACKFILL") return SelectionRole.BACKFILL;
  if (category === "CONFIDENCE_REBUILD") return SelectionRole.CONFIDENCE_REBUILD;
  if (category === "CORE_MATCH_DROP") return SelectionRole.CORE_MATCH_DROP;
  if (category === "REDUCED_MATCH_LOAD_DROP") return SelectionRole.REDUCED_MATCH_LOAD_DROP;
  return SelectionRole.MANUAL_OVERRIDE;
}

// A non-core movement requires a MovementLedger entry.
// controlledDoubleLoad is a legacy flag (no new true values are generated).
function isNonCoreMovement(player: SelectedPlayer, targetTeamId: string): boolean {
  if (player.selectionCategory === "SUPPORT") return true;
  if (player.selectionCategory === "DEVELOPMENT") return true;
  if (player.selectionCategory === "BACKFILL") return true;
  if (player.controlledDoubleLoad === true) return true;
  if (player.coreTeamId !== targetTeamId) return true;
  return false;
}

async function createMovementLedgerEntry(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  player: SelectedPlayer,
  matchId: string,
  matchRoundId: string,
  targetTeamId: string,
) {
  const role = mapSelectionCategoryToRole(player.selectionCategory);
  // controlledDoubleLoad is a legacy flag. No new true values are written
  // by the generation engine. Kept for backward compatibility.
  const isControlledDoubleLoad = player.controlledDoubleLoad === true;

  if (isControlledDoubleLoad && player.coreTeamId === targetTeamId) {
    await tx.movementLedger.create({
      data: {
        matchId,
        matchRoundId,
        playerId: player.playerId,
        fromTeamId: player.coreTeamId,
        toTeamId: targetTeamId,
        role,
        controlledDoubleLoad: true,
        reason: "controlled_double_load",
        explanation: player.selectionReason,
        isDraft: true,
      },
    });
    return;
  }

  if (player.coreTeamId !== targetTeamId) {
    await tx.movementLedger.create({
      data: {
        matchId,
        matchRoundId,
        playerId: player.playerId,
        fromTeamId: player.coreTeamId,
        toTeamId: targetTeamId,
        role,
        controlledDoubleLoad: isControlledDoubleLoad,
        reason: player.selectionCategory.toLowerCase(),
        explanation: player.selectionReason,
        isDraft: true,
      },
    });
  }
}

export async function createGeneratedDraftSelection(
  matchId: string,
  generatedSelection: GeneratedSelection,
) {
  const matchRoundId = generatedSelection.matchRoundId;
  const targetTeamId = generatedSelection.teamId;

  await db.$transaction(async (tx) => {
    await tx.selection.deleteMany({
      where: {
        matchId,
        status: SelectionStatus.DRAFT,
      },
    });

    await tx.movementLedger.deleteMany({
      where: {
        matchId,
        isDraft: true,
      },
    });

    for (const player of generatedSelection.selectedPlayers) {
      await tx.selection.create({
        data: {
          matchId,
          matchRoundId,
          playerId: player.playerId,
          role: mapSelectionCategoryToRole(player.selectionCategory),
          controlledDoubleLoad: player.controlledDoubleLoad === true,
          status: SelectionStatus.DRAFT,
          manuallyAdded: false,
          manuallyRemoved: false,
          autoSelected: true,
          sourceTeamName: player.coreTeamName,
          targetTeamName: generatedSelection.teamName,
          selectionReason: player.selectionReason,
          explanation: {
            summary: player.selectionReason,
            autoSelected: true,
            manuallyAdded: false,
            manuallyRemoved: false,
            sourceTeamName: player.coreTeamName,
            targetTeamName: generatedSelection.teamName,
            chosenPosition: player.chosenPosition ?? null,
            explanations: player.explanations,
          },
        },
      });

      if (isNonCoreMovement(player, targetTeamId)) {
        await createMovementLedgerEntry(tx, player, matchId, matchRoundId, targetTeamId);
      }
    }
  });
}

export async function createGeneratedDraftRound(
  generatedRound: GeneratedRound,
) {
  const matchIds = generatedRound.matchResults.map((m) => m.matchId);

  await db.$transaction(async (tx) => {
    await tx.selection.deleteMany({
      where: {
        matchId: { in: matchIds },
        status: SelectionStatus.DRAFT,
      },
    });

    await tx.movementLedger.deleteMany({
      where: {
        matchId: { in: matchIds },
        isDraft: true,
      },
    });

    for (const matchResult of generatedRound.matchResults) {
      for (const player of matchResult.selectedPlayers) {
        const targetTeamId = matchResult.teamId;
        await tx.selection.create({
          data: {
            matchId: matchResult.matchId,
            matchRoundId: matchResult.matchRoundId,
            playerId: player.playerId,
            role: mapSelectionCategoryToRole(player.selectionCategory),
            controlledDoubleLoad: player.controlledDoubleLoad === true,
            status: SelectionStatus.DRAFT,
            manuallyAdded: false,
            manuallyRemoved: false,
            autoSelected: true,
            sourceTeamName: player.coreTeamName,
            targetTeamName: matchResult.teamName,
            selectionReason: player.selectionReason,
            explanation: {
              summary: player.selectionReason,
              autoSelected: true,
              manuallyAdded: false,
              manuallyRemoved: false,
              sourceTeamName: player.coreTeamName,
              targetTeamName: matchResult.teamName,
              chosenPosition: player.chosenPosition ?? null,
              explanations: player.explanations,
            },
          },
        });

        if (isNonCoreMovement(player, targetTeamId)) {
          await createMovementLedgerEntry(tx, player, matchResult.matchId, matchResult.matchRoundId, targetTeamId);
        }
      }
    }
  });
}