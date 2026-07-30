import { db } from "@/lib/db";
import { formatIsoWeekKey, getWeekRange } from "@/lib/date-utils";

export type RegroupResult = {
  roundsCreated: number;
  roundsMerged: number;
  matchesMoved: number;
  roundsRemoved: number;
};

export async function regroupMatchesIntoIsoWeekRounds(): Promise<RegroupResult> {
  const allRounds = await db.matchRound.findMany({
    include: {
      matches: { select: { id: true, startsAt: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (allRounds.length === 0) {
    return { roundsCreated: 0, roundsMerged: 0, matchesMoved: 0, roundsRemoved: 0 };
  }

  const weekGroups = new Map<string, { weekKey: string; weekLabel: string; weekStart: Date; weekEnd: Date; roundIds: string[]; matchIds: string[] }>();

  for (const round of allRounds) {
    if (round.matches.length === 0) continue;

    const firstMatchDate = round.matches.reduce((earliest: Date, m) => {
      return m.startsAt < earliest ? m.startsAt : earliest;
    }, round.matches[0]!.startsAt);

    const weekKey = formatIsoWeekKey(firstMatchDate);
    const { startsAt: weekStart, endsAt: weekEnd } = getWeekRange(firstMatchDate);
    const weekLabel = `W${String(parseInt(weekKey.split("-W")[1]!, 10)).padStart(2, "0")} ${weekKey.split("-W")[0]}`;

    const existing = weekGroups.get(weekKey);
    if (existing) {
      existing.roundIds.push(round.id);
      for (const m of round.matches) {
        existing.matchIds.push(m.id);
      }
    } else {
      weekGroups.set(weekKey, {
        weekKey,
        weekLabel,
        weekStart,
        weekEnd,
        roundIds: [round.id],
        matchIds: round.matches.map((m) => m.id),
      });
    }
  }

  let roundsMerged = 0;
  let matchesMoved = 0;
  let roundsRemoved = 0;

  for (const [_weekKey, group] of weekGroups) {
    const canonicalRoundId = group.roundIds[0]!;

    if (group.roundIds.length > 1) {
      roundsMerged++;

      for (let i = 1; i < group.roundIds.length; i++) {
        const redundantRoundId = group.roundIds[i]!;

        const hasFinalizedSelections = await db.selection.findFirst({
          where: { matchRoundId: redundantRoundId, status: "FINALIZED" },
          select: { id: true },
        });

        if (hasFinalizedSelections) {
          const roundMatches = await db.match.findMany({
            where: { matchRoundId: redundantRoundId },
          });

          for (const match of roundMatches) {
            await db.match.update({
              where: { id: match.id },
              data: { matchRoundId: canonicalRoundId },
            });
            matchesMoved++;
          }

          const draftSelections = await db.selection.findMany({
            where: { matchRoundId: redundantRoundId, status: { not: "FINALIZED" } },
          });
          for (const sel of draftSelections) {
            await db.selection.update({
              where: { id: sel.id },
              data: { matchRoundId: canonicalRoundId },
            });
          }

          const draftWarnings = await db.warning.findMany({
            where: { matchRoundId: redundantRoundId, resolved: false },
          });
          for (const w of draftWarnings) {
            await db.warning.update({
              where: { id: w.id },
              data: { matchRoundId: canonicalRoundId },
            });
          }

          await db.matchRound.delete({ where: { id: redundantRoundId } });
          roundsRemoved++;
        } else {
          await db.selection.updateMany({
            where: { matchRoundId: redundantRoundId },
            data: { matchRoundId: canonicalRoundId },
          });

          await db.warning.updateMany({
            where: { matchRoundId: redundantRoundId },
            data: { matchRoundId: canonicalRoundId },
          });

          const roundMatches = await db.match.findMany({
            where: { matchRoundId: redundantRoundId },
          });
          for (const match of roundMatches) {
            await db.match.update({
              where: { id: match.id },
              data: { matchRoundId: canonicalRoundId },
            });
            matchesMoved++;
          }

          await db.matchRound.delete({ where: { id: redundantRoundId } });
          roundsRemoved++;
        }
      }
    }

    await db.matchRound.update({
      where: { id: canonicalRoundId },
      data: { name: group.weekLabel },
    });
  }

  const emptyRounds = await db.matchRound.findMany({
    where: { matches: { none: {} }, status: { not: "FINALIZED" } },
  });

  for (const emptyRound of emptyRounds) {
    await db.warning.deleteMany({ where: { matchRoundId: emptyRound.id } });
    await db.selection.deleteMany({ where: { matchRoundId: emptyRound.id } });
    await db.matchRound.delete({ where: { id: emptyRound.id } });
    roundsRemoved++;
  }

  return { roundsCreated: 0, roundsMerged, matchesMoved, roundsRemoved };
}