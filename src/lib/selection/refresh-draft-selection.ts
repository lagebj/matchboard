import { type Prisma, SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { generateSelection } from "@/lib/selection/generate-selection";
import { generateMatchRound } from "@/lib/selection/generate-round";
import { createGeneratedDraftRound, createGeneratedDraftSelection } from "@/lib/selection/save-generated-draft";
import { buildPersistableWarnings, persistRoundWarnings } from "@/lib/selection/persist-warnings";
import { persistRoundExplanations } from "@/lib/selection/persist-explanations";
import { enrichSelectionsWithIntent } from "@/lib/selection/explanation-enrichment";
import { reconcileRoundAfterDraftMutation } from "@/lib/selection/reconcile-integrity";
import { requireOpenLeagueSeasonForMatch } from "@/lib/seasons/require-open-league-season";

type SelectionRow = { manuallyAdded: boolean; manuallyRemoved: boolean; explanation: Prisma.JsonValue };

function hasManualDraftChanges(selections: SelectionRow[]) {
  return selections.some(
    (selection) => selection.manuallyAdded || selection.manuallyRemoved,
  );
}

async function cloneDraftSelection(matchId: string) {
  const latestSelections = await db.selection.findMany({
    where: {
      matchId,
      status: SelectionStatus.DRAFT,
    },
    select: {
      matchRoundId: true,
      playerId: true,
      role: true,
      explanation: true,
      manuallyAdded: true,
      manuallyRemoved: true,
      autoSelected: true,
      sourceTeamName: true,
      targetTeamName: true,
      selectionReason: true,
      overrideReason: true,
      overrideReasonCategory: true,
      overrideReasonDetail: true,
      controlledDoubleLoad: true,
      matchdayResponsibility: true,
      organisationId: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  if (latestSelections.length === 0) {
    throw new Error("Draft selection not found.");
  }

  const matchRoundId = latestSelections[0]!.matchRoundId;

  const existingDraftPlayerIds = new Set(latestSelections.map((s) => s.playerId));

  await db.$transaction(async (tx) => {
    await tx.selection.deleteMany({
      where: {
        matchId,
        status: SelectionStatus.DRAFT,
      },
    });

    for (const selection of latestSelections) {
      await tx.selection.create({
        data: {
          organisationId: selection.organisationId,
          matchId,
          matchRoundId: selection.matchRoundId,
          playerId: selection.playerId,
          role: selection.role,
          controlledDoubleLoad: selection.controlledDoubleLoad,
          status: SelectionStatus.DRAFT,
          explanation: selection.explanation as Prisma.InputJsonValue,
          manuallyAdded: selection.manuallyAdded,
          manuallyRemoved: selection.manuallyRemoved,
          autoSelected: selection.autoSelected,
          sourceTeamName: selection.sourceTeamName,
          targetTeamName: selection.targetTeamName,
          selectionReason: selection.selectionReason,
          overrideReason: selection.overrideReason,
          overrideReasonCategory: selection.overrideReasonCategory,
          overrideReasonDetail: selection.overrideReasonDetail,
          matchdayResponsibility: selection.matchdayResponsibility,
        },
      });
    }

    await tx.selection.deleteMany({
      where: {
        matchId,
        playerId: { notIn: [...existingDraftPlayerIds] },
        status: SelectionStatus.DRAFT,
      },
    });
  });
}

export async function refreshDraftSelection(matchId: string) {
  await requireOpenLeagueSeasonForMatch(matchId);

  const match = await db.match.findUnique({
    where: {
      id: matchId,
    },
    include: {
      selections: {
        select: {
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

  if (match.status === "CANCELLED") {
    throw new Error("Cancelled matches cannot be regenerated. Reopen the match first.");
  }

  const latestSelection = match.selections[0] ?? null;

  if (latestSelection?.status === SelectionStatus.FINALIZED) {
    throw new Error("Finalised matches cannot be recalculated.");
  }

  const allDraftSelections = await db.selection.findMany({
    where: {
      matchId,
      status: SelectionStatus.DRAFT,
    },
    select: {
      manuallyAdded: true,
      manuallyRemoved: true,
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

  const matchRound = await db.matchRound.findFirst({
    where: { matches: { some: { id: matchId } } },
    include: {
      matches: {
        select: {
          id: true,
          team: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (matchRound) {
    await reconcileRoundAfterDraftMutation(matchRound.id);
  }

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
    throw new Error("Finalised matches cannot be recalculated.");
  }

  const allDraftSelections = await db.selection.findMany({
    where: {
      matchRoundId,
      status: SelectionStatus.DRAFT,
    },
    select: {
      manuallyAdded: true,
      manuallyRemoved: true,
      explanation: true,
    },
  });

  if (allDraftSelections.length > 0 && hasManualDraftChanges(allDraftSelections)) {
    await cloneDraftRound(matchRoundId);
    return { preservedManualDraft: true };
  }

  const generatedRound = await generateMatchRound(matchRoundId);
  await createGeneratedDraftRound(generatedRound);

  const matchIdByTeamName = new Map<string, string>();
  const teamIdByTeamName = new Map<string, string>();
  let organisationId = "";
  for (const matchResult of generatedRound.matchResults) {
    const match = await db.match.findUnique({
      where: { id: matchResult.matchId },
      select: { team: { select: { id: true, name: true } }, organisationId: true },
    });
    if (match?.team) {
      matchIdByTeamName.set(match.team.name, matchResult.matchId);
      teamIdByTeamName.set(match.team.name, match.team.id);
    }
    if (!organisationId && match) {
      organisationId = match.organisationId;
    }
  }

  const warnings = buildPersistableWarnings(generatedRound, matchIdByTeamName, teamIdByTeamName, organisationId);
  await persistRoundWarnings(warnings);
  await persistRoundExplanations(generatedRound);
  await enrichSelectionsWithIntent(generatedRound.matchResults.map((m) => m.matchId));
  await reconcileRoundAfterDraftMutation(matchRoundId);

  return { preservedManualDraft: false };
}

async function cloneDraftRound(matchRoundId: string) {
  const latestSelections = await db.selection.findMany({
    where: {
      matchRoundId,
      status: SelectionStatus.DRAFT,
    },
    select: {
      matchId: true,
      matchRoundId: true,
      playerId: true,
      role: true,
      explanation: true,
      manuallyAdded: true,
      manuallyRemoved: true,
      autoSelected: true,
      sourceTeamName: true,
      targetTeamName: true,
      selectionReason: true,
      overrideReason: true,
      overrideReasonCategory: true,
      overrideReasonDetail: true,
      controlledDoubleLoad: true,
      matchdayResponsibility: true,
      organisationId: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  if (latestSelections.length === 0) {
    throw new Error("Draft selections not found.");
  }

  await db.$transaction(async (tx) => {
    await tx.selection.deleteMany({
      where: {
        matchRoundId,
        status: SelectionStatus.DRAFT,
      },
    });

    for (const selection of latestSelections) {
      await tx.selection.create({
        data: {
          organisationId: selection.organisationId,
          matchId: selection.matchId,
          matchRoundId: selection.matchRoundId,
          playerId: selection.playerId,
          role: selection.role,
          controlledDoubleLoad: selection.controlledDoubleLoad,
          status: SelectionStatus.DRAFT,
          explanation: selection.explanation as Prisma.InputJsonValue,
          manuallyAdded: selection.manuallyAdded,
          manuallyRemoved: selection.manuallyRemoved,
          autoSelected: selection.autoSelected,
          sourceTeamName: selection.sourceTeamName,
          targetTeamName: selection.targetTeamName,
          selectionReason: selection.selectionReason,
          overrideReason: selection.overrideReason,
          overrideReasonCategory: selection.overrideReasonCategory,
          overrideReasonDetail: selection.overrideReasonDetail,
          matchdayResponsibility: selection.matchdayResponsibility,
        },
      });
    }
  });
}