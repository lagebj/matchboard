import { type Prisma, SelectionStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { generateSelection } from "@/lib/selection/generate-selection";
import { generateMatchRound } from "@/lib/selection/generate-round";
import { createGeneratedDraftRound, createGeneratedDraftSelection } from "@/lib/selection/save-generated-draft";
import { buildPersistableWarnings, persistRoundWarnings } from "@/lib/selection/persist-warnings";
import { persistRoundExplanations } from "@/lib/selection/persist-explanations";

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
      status: SelectionStatus.DRAFT,
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
          matchId,
          matchRoundId,
          playerId: selection.playerId,
          role: selection.role,
          status: SelectionStatus.DRAFT,
          explanation: selection.explanation as Prisma.InputJsonValue,
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
      status: SelectionStatus.DRAFT,
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
    const matchIdByTeamName = new Map<string, string>();
    const teamIdByTeamName = new Map<string, string>();
    for (const m of matchRound.matches) {
      matchIdByTeamName.set(m.team.name, m.id);
      teamIdByTeamName.set(m.team.name, m.team.id);
    }

    const generatedRound: import("@/lib/selection/types").GeneratedRound = {
      matchRoundId: matchRound.id,
      roundWarnings: [],
      matchResults: [generatedSelection],
      generatedAt: new Date(),
      generationSummary: { supportNeeds: [], routedCoreMatchDrops: [], unroutedExclusions: [] },
    };

    const matchWarnings = buildPersistableWarnings(generatedRound, matchIdByTeamName, teamIdByTeamName)
      .filter((w) => w.matchId === matchId);

    const existingWarnings = await db.warning.findMany({
      where: { matchRoundId: matchRound.id, resolved: true },
      select: { id: true, rule: true, playerId: true, matchId: true, teamId: true, severity: true, message: true, resolved: true },
    });

    const otherMatchWarnings = await db.warning.findMany({
      where: { matchRoundId: matchRound.id, matchId: { not: matchId } },
      select: { matchRoundId: true, matchId: true, playerId: true, teamId: true, severity: true, rule: true, message: true, resolved: true },
    });

    const allWarnings = [...otherMatchWarnings, ...matchWarnings];

    const resolvedByKey = new Map<string, typeof existingWarnings[number]>();
    for (const r of existingWarnings) {
      const key = `${r.rule}|${r.playerId ?? ""}|${r.matchId ?? ""}|${r.teamId ?? ""}`;
      resolvedByKey.set(key, r);
    }

    await db.$transaction(async (tx) => {
      await tx.warning.deleteMany({
        where: { matchRoundId: matchRound.id },
      });

      for (const w of allWarnings) {
        const key = `${w.rule}|${w.playerId ?? ""}|${w.matchId ?? ""}|${w.teamId ?? ""}`;
        const matching = resolvedByKey.get(key);

        await tx.warning.create({
          data: {
            matchRoundId: w.matchRoundId,
            matchId: w.matchId,
            playerId: w.playerId,
            teamId: w.teamId,
            severity: w.severity,
            rule: w.rule,
            message: w.message,
            resolved: matching?.resolved ?? false,
          },
        });
      }
    });
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
    throw new Error("Finalized matches cannot be recalculated.");
  }

  const allDraftSelections = await db.selection.findMany({
    where: {
      matchRoundId,
      status: SelectionStatus.DRAFT,
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

  const matchIdByTeamName = new Map<string, string>();
  const teamIdByTeamName = new Map<string, string>();
  for (const matchResult of generatedRound.matchResults) {
    const match = await db.match.findUnique({
      where: { id: matchResult.matchId },
      select: { team: { select: { id: true, name: true } } },
    });
    if (match?.team) {
      matchIdByTeamName.set(match.team.name, matchResult.matchId);
      teamIdByTeamName.set(match.team.name, match.team.id);
    }
  }

  const warnings = buildPersistableWarnings(generatedRound, matchIdByTeamName, teamIdByTeamName);
  await persistRoundWarnings(warnings);
  await persistRoundExplanations(generatedRound);

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
          matchId: selection.matchId,
          matchRoundId: selection.matchRoundId,
          playerId: selection.playerId,
          role: selection.role,
          status: SelectionStatus.DRAFT,
          explanation: selection.explanation as Prisma.InputJsonValue,
        },
      });
    }
  });
}