import { db } from "@/lib/db";
import {
  type CombinationEvidenceRow,
  type ConfidenceLevel,
  deriveConfidence,
} from "./combination-topology";
import type { FootballMatchRef } from "./football-match-ref";

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
  ref: FootballMatchRef,
  evidence: CombinationEvidenceRow[],
): Promise<void> {
  const deleteWhere = ref.kind === "LEAGUE_MATCH" ? { matchId: ref.matchId } : { eventMatchId: ref.eventMatchId };

  await db.$transaction(async (tx) => {
    await tx.combinationEvidence.deleteMany({
      where: deleteWhere,
    });

    if (evidence.length > 0) {
      await tx.combinationEvidence.createMany({
        data: evidence.map((row) => ({
          id: row.id,
          organisationId: row.organisationId,
          matchId: row.matchId,
          eventMatchId: row.eventMatchId,
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

type CombinationEvidenceDbRow = Awaited<ReturnType<typeof db.combinationEvidence.findMany>>[number];

function mapCombinationEvidenceRow(r: CombinationEvidenceDbRow): CombinationEvidenceRow {
  return {
    id: r.id,
    organisationId: r.organisationId,
    matchId: r.matchId,
    eventMatchId: r.eventMatchId,
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
  };
}

export async function getMatchCombinationEvidence(
  matchId: string,
): Promise<CombinationEvidenceRow[]> {
  const rows = await db.combinationEvidence.findMany({
    where: { matchId },
  });

  return rows.map(mapCombinationEvidenceRow);
}

export async function getMatchCombinationEvidenceForRef(ref: FootballMatchRef): Promise<CombinationEvidenceRow[]> {
  const rows = await db.combinationEvidence.findMany({
    where: ref.kind === "LEAGUE_MATCH" ? { matchId: ref.matchId } : { eventMatchId: ref.eventMatchId },
  });

  return rows.map(mapCombinationEvidenceRow);
}

export async function getSeasonCombinationEvidence(
  leagueSeasonId: string,
): Promise<CombinationEvidenceRow[]> {
  const rows = await db.combinationEvidence.findMany({
    where: { leagueSeasonId },
  });

  return rows.map(mapCombinationEvidenceRow);
}

/**
 * Combination evidence recorded in matches against one specific opponent team — factual context
 * for "Previous encounters" (AGENTS.md opponent terminology), never a selection-scoring input.
 * Returns [] rather than throwing when the opponent has no recorded matches/evidence yet.
 */
export async function getOpponentCombinationEvidence(
  opponentTeamId: string,
): Promise<SeasonCombinationSummary[]> {
  const matches = await db.match.findMany({
    where: { opponentTeamId },
    select: { id: true },
  });
  if (matches.length === 0) return [];

  const rows = await db.combinationEvidence.findMany({
    where: { matchId: { in: matches.map((m) => m.id) } },
  });

  return aggregateSeasonCombinations(rows.map(mapCombinationEvidenceRow));
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

  const evidence: CombinationEvidenceRow[] = rows.map(mapCombinationEvidenceRow);

  // Event rows have matchId === null (they key on eventMatchId instead) -- excluded here
  // pending a later PR that also resolves Event opponent history for this read path.
  const matchIds = [...new Set(evidence.map((r) => r.matchId).filter((id): id is string => id !== null))];
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
        const opp = row.matchId ? opponentByMatch.get(row.matchId) : undefined;
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
        const opp = row.matchId ? opponentByMatch.get(row.matchId) : undefined;
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
  ref: FootballMatchRef,
  leagueSeasonId: string,
): Promise<{ intervalsCreated: number; evidenceCreated: number }> {
  const { computeMatchCombinationEvidence } = await import("./combination-topology");

  const combinations = await computeMatchCombinationEvidence(ref, leagueSeasonId);

  await persistMatchCombinationEvidence(ref, combinations);

  return {
    intervalsCreated: 0,
    evidenceCreated: combinations.length,
  };
}

/**
 * Season partnership evidence relevant to a specific planned pairing (line-up planning, rotation
 * planning) — every player in the summary must be part of the given set. Pure/no I/O so it can be
 * unit tested without a database; the caller is responsible for scoping `summaries` to the right
 * league season. Never includes INSUFFICIENT confidence — that is "not enough evidence yet", not
 * negative, but also not worth surfacing as a planning note (SELECTION_INTEGRATION.md
 * "Explanations").
 */
export function selectRelevantPartnerships(
  playerIds: string[],
  summaries: SeasonCombinationSummary[],
): SeasonCombinationSummary[] {
  const idSet = new Set(playerIds);
  return summaries.filter(
    (s) =>
      s.family === "PARTNERSHIP" &&
      s.confidence !== "INSUFFICIENT" &&
      s.playerIds.every((id) => idSet.has(id)),
  );
}