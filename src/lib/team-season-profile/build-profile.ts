import { computeSourceFingerprint } from "@/lib/ai/fingerprints";
import { buildMatchRhythmPatterns, buildCombinationPatterns } from "@/lib/team-season-profile/pattern-catalogue";
import { buildTacticalThemePatterns } from "@/lib/team-season-profile/qualitative-patterns";
import { buildPlayerContributionPatterns } from "@/lib/team-season-profile/player-contributions";
import { parseTeamSeasonProfileV1, TEAM_SEASON_PROFILE_VERSION, type ConfidenceLevel, type TeamSeasonPattern, type TeamSeasonProfileV1 } from "@/lib/team-season-profile/contracts";
import type { ProfileSources } from "@/lib/team-season-profile/load-profile-sources";

/**
 * Orchestrator (ADR-0156 Slice 1). Pure given already-loaded `ProfileSources` -- all I/O lives
 * in `load-profile-sources.ts`. Combines the four pattern families, ranks them deterministically
 * (`02_TEAM_SEASON_PROFILE_DOMAIN.md` §6), and assembles + validates the versioned
 * `TeamSeasonProfileV1` contract.
 */

const CONFIDENCE_RANK: Record<ConfidenceLevel, number> = { ESTABLISHED: 2, EMERGING: 1, INSUFFICIENT: 0 };

function eventSupport(pattern: TeamSeasonPattern): number {
  return pattern.sample.eventCount ?? pattern.sample.observationCount ?? pattern.sample.exposureMinutes ?? 0;
}

function lastObservedMs(pattern: TeamSeasonPattern): number {
  return pattern.lastObservedAt ? new Date(pattern.lastObservedAt).getTime() : 0;
}

/**
 * §6 ranking order: ESTABLISHED before EMERGING; higher match count; higher event/exposure
 * support within the same family; more recent last observation; a final stable tiebreak on the
 * pattern key so ranking never depends on input array order (Test plan A.5).
 */
export function rankPatterns(patterns: TeamSeasonPattern[]): TeamSeasonPattern[] {
  return [...patterns].sort((a, b) => {
    if (CONFIDENCE_RANK[b.evidenceStrength] !== CONFIDENCE_RANK[a.evidenceStrength]) {
      return CONFIDENCE_RANK[b.evidenceStrength] - CONFIDENCE_RANK[a.evidenceStrength];
    }
    if (b.sample.matches !== a.sample.matches) return b.sample.matches - a.sample.matches;
    if (eventSupport(b) !== eventSupport(a)) return eventSupport(b) - eventSupport(a);
    if (lastObservedMs(b) !== lastObservedMs(a)) return lastObservedMs(b) - lastObservedMs(a);
    return a.key.localeCompare(b.key);
  });
}

/**
 * Diversity-aware top-N selection for presentation slots (§6 "avoid using all summary slots for
 * near-duplicate rhythm windows"): defers a second `MATCH_RHYTHM` pattern while another family
 * still has room, then backfills if diversity would otherwise leave slots empty. `rankedPatterns`
 * must already be in `rankPatterns()` order.
 */
export function selectTopPatternKeys(rankedPatterns: TeamSeasonPattern[], limit: number, preferFamilyDiversity = false): string[] {
  if (!preferFamilyDiversity) return rankedPatterns.slice(0, limit).map((p) => p.key);

  const selected: TeamSeasonPattern[] = [];
  const deferred: TeamSeasonPattern[] = [];
  const familyCounts = new Map<string, number>();

  for (const pattern of rankedPatterns) {
    if (selected.length >= limit) break;
    const familyCount = familyCounts.get(pattern.family) ?? 0;
    const otherFamiliesRemain = rankedPatterns.some((p) => p.family !== pattern.family && !selected.includes(p));
    if (familyCount >= 1 && otherFamiliesRemain) {
      deferred.push(pattern);
      continue;
    }
    selected.push(pattern);
    familyCounts.set(pattern.family, familyCount + 1);
  }

  for (const pattern of deferred) {
    if (selected.length >= limit) break;
    selected.push(pattern);
  }

  return selected.slice(0, limit).map((p) => p.key);
}

export function buildTeamSeasonProfile(sources: ProfileSources): TeamSeasonProfileV1 {
  const rhythmPatterns = buildMatchRhythmPatterns(sources.rhythmSamples, sources.recentMatchIds);
  const themePatterns = buildTacticalThemePatterns(sources.themeObservations, sources.eligibleMatches.length, sources.recentMatchIds);
  const playerPatterns = buildPlayerContributionPatterns(sources.rhythmSamples, sources.playerExposures, sources.realPlayerIds, sources.recentMatchIds);
  const combinationPatterns = buildCombinationPatterns({
    evidenceRows: sources.combinationEvidenceRows,
    opponentByMatch: sources.opponentByMatch,
    recentMatchIds: sources.recentMatchIds,
    matchDatesById: new Map(sources.eligibleMatches.map((m) => [m.id, m.startsAt])),
  });

  const patterns = [...rhythmPatterns, ...themePatterns, ...playerPatterns, ...combinationPatterns];
  const topPatternKeys = rankPatterns(patterns).map((p) => p.key);

  // "Usable timing" means every goal event in the match has exact (non-approximate) timing --
  // a match with zero goal events has nothing imprecise to report, so it counts as usable too
  // (ADR-0156 §17: approximate timing must remain visible wherever it actually occurs).
  const matchesWithUsableTiming = sources.rhythmSamples.filter((s) => s.goalEvents.every((g) => !g.approximateTiming)).length;

  const profile: TeamSeasonProfileV1 = {
    version: TEAM_SEASON_PROFILE_VERSION,
    organisationId: sources.organisationId,
    teamId: sources.teamId,
    leagueSeasonId: sources.leagueSeasonId,
    seasonStart: sources.seasonStart.toISOString(),
    seasonEnd: sources.seasonEnd.toISOString(),
    computedAt: new Date().toISOString(),
    sourceFingerprint: computeSourceFingerprint(sources.fingerprintInput),
    sample: {
      completedMatches: sources.eligibleMatches.length,
      matchesWithUsableTiming,
      totalResolvedMinutes: sources.totalResolvedMinutes,
      qualitativeObservationCount: sources.qualitativeObservationCount,
      combinationEvidenceCount: sources.combinationEvidenceCount,
    },
    patterns,
    topPatternKeys,
  };

  return parseTeamSeasonProfileV1(profile);
}
