import { db } from "@/lib/db";
import {
  type CombinationEvidenceRow,
  type ConfidenceLevel,
  deriveConfidence,
} from "./combination-topology";

export type SeasonCombinationSummary = {
  playerIds: string[];
  positions: string[];
  family: string;
  subtype: string | null;
  totalMinutesTogether: number;
  matchCount: number;
  goalsForTotal: number;
  goalsAgainstTotal: number;
  directGoalContributionsTotal: number;
  directAssistContributionsTotal: number;
  opponentDiversity: number;
  confidence: ConfidenceLevel;
  approximateTiming: boolean;
};

export async function persistMatchCombinationEvidence(
  matchId: string,
  evidence: CombinationEvidenceRow[],
): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.combinationEvidence.deleteMany({
      where: { matchId },
    });

    if (evidence.length > 0) {
      await tx.combinationEvidence.createMany({
        data: evidence.map((row) => ({
          id: row.id,
          organisationId: row.organisationId,
          matchId: row.matchId,
          family: row.family,
          subtype: row.subtype,
          playerIds: row.playerIds,
          positions: row.positions,
          minutesTogether: row.minutesTogether,
          goalsForWhilePresent: row.goalsForWhilePresent,
          goalsAgainstWhilePresent: row.goalsAgainstWhilePresent,
          directGoalContributions: row.directGoalContributions,
          directAssistContributions: row.directAssistContributions,
          opponentDiversity: row.opponentDiversity,
          confidence: row.confidence,
          approximateTiming: row.approximateTiming,
          leagueSeasonId: row.leagueSeasonId,
        })),
      });
    }
  });
}

export async function getMatchCombinationEvidence(
  matchId: string,
): Promise<CombinationEvidenceRow[]> {
  const rows = await db.combinationEvidence.findMany({
    where: { matchId },
  });

  return rows.map((r) => ({
    id: r.id,
    organisationId: r.organisationId,
    matchId: r.matchId,
    family: r.family as CombinationEvidenceRow["family"],
    subtype: r.subtype as CombinationEvidenceRow["subtype"],
    playerIds: r.playerIds as string[],
    positions: r.positions as string[],
    minutesTogether: r.minutesTogether,
    goalsForWhilePresent: r.goalsForWhilePresent,
    goalsAgainstWhilePresent: r.goalsAgainstWhilePresent,
    directGoalContributions: r.directGoalContributions,
    directAssistContributions: r.directAssistContributions,
    opponentDiversity: r.opponentDiversity,
    confidence: r.confidence as ConfidenceLevel,
    approximateTiming: r.approximateTiming,
    leagueSeasonId: r.leagueSeasonId,
    createdAt: r.createdAt,
  }));
}

export async function getSeasonCombinationEvidence(
  leagueSeasonId: string,
): Promise<CombinationEvidenceRow[]> {
  const rows = await db.combinationEvidence.findMany({
    where: { leagueSeasonId },
  });

  return rows.map((r) => ({
    id: r.id,
    organisationId: r.organisationId,
    matchId: r.matchId,
    family: r.family as CombinationEvidenceRow["family"],
    subtype: r.subtype as CombinationEvidenceRow["subtype"],
    playerIds: r.playerIds as string[],
    positions: r.positions as string[],
    minutesTogether: r.minutesTogether,
    goalsForWhilePresent: r.goalsForWhilePresent,
    goalsAgainstWhilePresent: r.goalsAgainstWhilePresent,
    directGoalContributions: r.directGoalContributions,
    directAssistContributions: r.directAssistContributions,
    opponentDiversity: r.opponentDiversity,
    confidence: r.confidence as ConfidenceLevel,
    approximateTiming: r.approximateTiming,
    leagueSeasonId: r.leagueSeasonId,
    createdAt: r.createdAt,
  }));
}

function pairKey(playerIds: string[]): string {
  return [...playerIds].sort().join(":");
}

export async function getSeasonCombinationEvidenceWithOpponents(
  leagueSeasonId: string,
): Promise<{ evidence: CombinationEvidenceRow[]; opponentByMatch: Map<string, string> }> {
  const rows = await db.combinationEvidence.findMany({
    where: { leagueSeasonId },
  });

  const evidence: CombinationEvidenceRow[] = rows.map((r) => ({
    id: r.id,
    organisationId: r.organisationId,
    matchId: r.matchId,
    family: r.family as CombinationEvidenceRow["family"],
    subtype: r.subtype as CombinationEvidenceRow["subtype"],
    playerIds: r.playerIds as string[],
    positions: r.positions as string[],
    minutesTogether: r.minutesTogether,
    goalsForWhilePresent: r.goalsForWhilePresent,
    goalsAgainstWhilePresent: r.goalsAgainstWhilePresent,
    directGoalContributions: r.directGoalContributions,
    directAssistContributions: r.directAssistContributions,
    opponentDiversity: r.opponentDiversity,
    confidence: r.confidence as ConfidenceLevel,
    approximateTiming: r.approximateTiming,
    leagueSeasonId: r.leagueSeasonId,
    createdAt: r.createdAt,
  }));

  const matchIds = [...new Set(evidence.map((r) => r.matchId))];
  const opponentByMatch = new Map<string, string>();

  if (matchIds.length > 0) {
    const matches = await db.match.findMany({
      where: { id: { in: matchIds } },
      select: { id: true, opponentTeamId: true },
    });
    for (const m of matches) {
      if (m.opponentTeamId) {
        opponentByMatch.set(m.id, m.opponentTeamId);
      }
    }
  }

  return { evidence, opponentByMatch };
}

export function aggregateSeasonCombinations(
  evidence: CombinationEvidenceRow[],
  opponentByMatch?: Map<string, string>,
): SeasonCombinationSummary[] {
  const aggregates = new Map<string, {
    playerIds: string[];
    positions: Set<string>;
    family: string;
    subtype: string | null;
    totalMinutesTogether: number;
    matchCount: number;
    goalsForTotal: number;
    goalsAgainstTotal: number;
    directGoalContributionsTotal: number;
    directAssistContributionsTotal: number;
    opponentSet: Set<string>;
    anyApproximateTiming: boolean;
  }>();

  for (const row of evidence) {
    const key = `${row.family}|${row.subtype ?? "null"}|${pairKey(row.playerIds)}`;
    const existing = aggregates.get(key);

    if (existing) {
      existing.totalMinutesTogether += row.minutesTogether;
      existing.matchCount += 1;
      existing.goalsForTotal += row.goalsForWhilePresent;
      existing.goalsAgainstTotal += row.goalsAgainstWhilePresent;
      existing.directGoalContributionsTotal += row.directGoalContributions;
      existing.directAssistContributionsTotal += row.directAssistContributions;
      for (const pos of row.positions) {
        existing.positions.add(pos);
      }
      existing.anyApproximateTiming = existing.anyApproximateTiming || row.approximateTiming;
      if (opponentByMatch) {
        const opp = opponentByMatch.get(row.matchId);
        if (opp) existing.opponentSet.add(opp);
      }
    } else {
      const agg = {
        playerIds: [...row.playerIds].sort(),
        positions: new Set(row.positions),
        family: row.family,
        subtype: row.subtype,
        totalMinutesTogether: row.minutesTogether,
        matchCount: 1,
        goalsForTotal: row.goalsForWhilePresent,
        goalsAgainstTotal: row.goalsAgainstWhilePresent,
        directGoalContributionsTotal: row.directGoalContributions,
        directAssistContributionsTotal: row.directAssistContributions,
        opponentSet: new Set<string>() as Set<string>,
        anyApproximateTiming: row.approximateTiming,
      };
      if (opponentByMatch) {
        const opp = opponentByMatch.get(row.matchId);
        if (opp) agg.opponentSet.add(opp);
      }
      aggregates.set(key, agg);
    }
  }

  const summaries: SeasonCombinationSummary[] = [];
  for (const data of aggregates.values()) {
    const confidence = deriveConfidence(
      data.totalMinutesTogether,
      data.matchCount,
      data.opponentSet.size || 1,
    );

    summaries.push({
      playerIds: data.playerIds,
      positions: [...data.positions],
      family: data.family,
      subtype: data.subtype,
      totalMinutesTogether: Math.round(data.totalMinutesTogether * 10) / 10,
      matchCount: data.matchCount,
      goalsForTotal: data.goalsForTotal,
      goalsAgainstTotal: data.goalsAgainstTotal,
      directGoalContributionsTotal: data.directGoalContributionsTotal,
      directAssistContributionsTotal: data.directAssistContributionsTotal,
      opponentDiversity: data.opponentSet.size || 1,
      confidence,
      approximateTiming: data.anyApproximateTiming,
    });
  }

  return summaries.sort((a, b) => b.totalMinutesTogether - a.totalMinutesTogether);
}

export async function rebuildMatchCombinationEvidence(
  matchId: string,
  leagueSeasonId: string,
): Promise<{ intervalsCreated: number; evidenceCreated: number }> {
  const { computeMatchCombinationEvidence } = await import("./combination-topology");

  const combinations = await computeMatchCombinationEvidence(matchId, leagueSeasonId);

  await persistMatchCombinationEvidence(matchId, combinations);

  return {
    intervalsCreated: 0,
    evidenceCreated: combinations.length,
  };
}