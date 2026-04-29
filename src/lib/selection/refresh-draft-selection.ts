import { type Prisma, SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { generateSelection } from "@/lib/selection/generate-selection";
import { generateMatchRound } from "@/lib/selection/generate-round";
import { createGeneratedDraftRound, createGeneratedDraftSelection } from "@/lib/selection/save-generated-draft";

type SelectionExplanationRow = { explanation: Prisma.JsonValue };

function hasManualDraftChanges(selections: SelectionExplanationRow[]) {
  return selections.some(
    (selection) => {
      const explanation = (selection.explanation ?? {}) as Record<string, unknown>;
      return explanation.manuallyAdded === true || explanation.manuallyRemoved === true;
    },
  );
}

async function cloneDraftSelection(matchId: string) {
  const latestSelections = await db.selection.findMany({
    where: {
      matchId,
    },
    select: {
      matchRoundId: true,
      playerId: true,
      role: true,
      explanation: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  if (latestSelections.length === 0) {
    throw new Error("Draft selection not found.");
  }

  const matchRoundId = latestSelections[0]!.matchRoundId;

  await db.$transaction(
    latestSelections.map((selection) =>
      db.selection.create({
        data: {
          matchId,
          matchRoundId,
          playerId: selection.playerId,
          role: selection.role,
          status: SelectionStatus.DRAFT,
          explanation: selection.explanation as Prisma.InputJsonValue,
        },
      }),
    ),
  );
}

export async function refreshDraftSelection(matchId: string) {
  const match = await db.match.findUnique({
    where: {
      id: matchId,
    },
    include: {
      selections: {
        select: {
          explanation: true,
          status: true,
        },
        orderBy: [{ createdAt: "desc" }],
        take: 1,
      },
    },
  });

  if (!match) {
    throw new Error("Match not found.");
  }

  const latestSelection = match.selections[0] ?? null;

  if (latestSelection?.status === SelectionStatus.FINALIZED) {
    throw new Error("Finalized matches cannot be recalculated.");
  }

  const allDraftSelections = await db.selection.findMany({
    where: {
      matchId,
    },
    select: {
      explanation: true,
    },
  });

  if (allDraftSelections.length > 0 && hasManualDraftChanges(allDraftSelections)) {
    await cloneDraftSelection(match.id);
    return {
      preservedManualDraft: true,
    };
  }

  const generatedSelection = await generateSelection(match.id);
  await createGeneratedDraftSelection(match.id, generatedSelection);

  return {
    preservedManualDraft: false,
  };
}

export async function refreshDraftSelections(matchIds: string[]) {
  for (const matchId of matchIds) {
    await refreshDraftSelection(matchId);
  }
}

export async function refreshDraftRound(matchRoundId: string) {
  const matchRound = await db.matchRound.findUnique({
    where: { id: matchRoundId },
    include: {
      matches: {
        select: {
          id: true,
          selections: {
            select: {
              explanation: true,
              status: true,
            },
            orderBy: [{ createdAt: "desc" }],
            take: 1,
          },
        },
      },
    },
  });

  if (!matchRound) {
    throw new Error("Match round not found.");
  }

  const hasFinalizedMatch = matchRound.matches.some(
    (match) => match.selections[0]?.status === SelectionStatus.FINALIZED,
  );

  if (hasFinalizedMatch) {
    throw new Error("Finalized matches cannot be recalculated.");
  }

  const allDraftSelections = await db.selection.findMany({
    where: {
      matchRoundId,
    },
    select: {
      explanation: true,
    },
  });

  if (allDraftSelections.length > 0 && hasManualDraftChanges(allDraftSelections)) {
    await cloneDraftRound(matchRoundId);
    return { preservedManualDraft: true };
  }

  const generatedRound = await generateMatchRound(matchRoundId);
  await createGeneratedDraftRound(generatedRound);

  return { preservedManualDraft: false };
}

async function cloneDraftRound(matchRoundId: string) {
  const latestSelections = await db.selection.findMany({
    where: {
      matchRoundId,
    },
    select: {
      matchId: true,
      matchRoundId: true,
      playerId: true,
      role: true,
      explanation: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  if (latestSelections.length === 0) {
    throw new Error("Draft selections not found.");
  }

  await db.$transaction(
    latestSelections.map((selection) =>
      db.selection.create({
        data: {
          matchId: selection.matchId,
          matchRoundId: selection.matchRoundId,
          playerId: selection.playerId,
          role: selection.role,
          status: SelectionStatus.DRAFT,
          explanation: selection.explanation as Prisma.InputJsonValue,
        },
      }),
    ),
  );
}
