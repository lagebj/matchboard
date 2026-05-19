import type { AutomaticSelectionCategory } from "@/lib/selection/types";
import type { MatchRecord, PathDestination, PlayerRecord, RotationCandidateCategory } from "@/lib/selection/selection-types";
import { type ReadinessSignalEntry, getReadinessScoreModifier } from "@/lib/selection/readiness-scoring";

export function getSuitabilityAndReadinessScore(
  player: PlayerRecord,
  candidateCategory: RotationCandidateCategory,
  readinessSignals: ReadinessSignalEntry[] = [],
): number {
  let score = 0;

  if (candidateCategory === "SUPPORT") {
    if (player.supportSuitability === "strong") score += 15;
    else if (player.supportSuitability === "avoid") score -= 25;
  }

  if (candidateCategory === "DEVELOPMENT") {
    if (player.developmentReadiness === "ready") score += 10;
  }

  score += getReadinessScoreModifier(player.id, readinessSignals);

  return score;
}

export function isDevelopmentBlocked(player: PlayerRecord): boolean {
  return player.developmentReadiness === "not_ready";
}

export function isSupportAvoidSuitability(player: PlayerRecord): boolean {
  return player.supportSuitability === "avoid";
}

export function checkPathCooldown(
  playerId: string,
  playerCoreTeamId: string,
  targetTeamId: string,
  candidateCategory: RotationCandidateCategory,
  rotationPaths: PathDestination[],
  finalizedSelections: { fromTeamId: string; matchStartsAt: Date; playerId: string; role: string; toTeamId: string }[],
  currentMatchDate: Date,
): { blocked: boolean; reason: string | null } {
  if (candidateCategory !== "SUPPORT" && candidateCategory !== "DEVELOPMENT") {
    return { blocked: false, reason: null };
  }

  const matchingPath = rotationPaths.find(
    (path) =>
      path.fromTeamId === playerCoreTeamId &&
      path.toTeamId === targetTeamId &&
      path.role.toUpperCase() === candidateCategory.toUpperCase(),
  );

  if (!matchingPath || matchingPath.cooldownRounds === null || matchingPath.cooldownRounds === undefined) {
    return { blocked: false, reason: null };
  }

  const cooldownRounds = matchingPath.cooldownRounds;
  if (cooldownRounds <= 0) {
    return { blocked: false, reason: null };
  }

  const pathSelections = finalizedSelections.filter(
    (sel) =>
      sel.playerId === playerId &&
      sel.fromTeamId === playerCoreTeamId &&
      sel.toTeamId === targetTeamId &&
      sel.role.toUpperCase() === candidateCategory.toUpperCase(),
  );

  const sortedSelections = pathSelections
    .filter((sel) => sel.matchStartsAt < currentMatchDate)
    .sort((a, b) => b.matchStartsAt.getTime() - a.matchStartsAt.getTime());

  if (sortedSelections.length === 0) {
    return { blocked: false, reason: null };
  }

  const mostRecentPathSelection = sortedSelections[0]!;

  const uniqueMatchDates = finalizedSelections
    .filter((sel) => sel.matchStartsAt < currentMatchDate)
    .map((sel) => sel.matchStartsAt.getTime());
  const uniqueRoundsSince = new Set(uniqueMatchDates.filter((d) => d >= mostRecentPathSelection.matchStartsAt.getTime())).size;

  if (uniqueRoundsSince <= cooldownRounds) {
    return {
      blocked: true,
      reason: `Path cooldown active: player already served as ${candidateCategory.toLowerCase()} from the same path within the last ${cooldownRounds} round(s).`,
    };
  }

  return { blocked: false, reason: null };
}

export function getAutomaticSelectionCategoryForRotationCandidate(
  candidateCategory: RotationCandidateCategory,
): AutomaticSelectionCategory {
  if (candidateCategory === "SUPPORT") {
    return "SUPPORT";
  }

  if (candidateCategory === "DEVELOPMENT") {
    return "DEVELOPMENT";
  }

  // RotationCandidateCategory no longer includes BACKFILL or CONFIDENCE_REBUILD.
  // These are generation-only SUPPORT/DEVELOPMENT now.
  return "DEVELOPMENT";
}

export function getPathBasedCategory(
  player: PlayerRecord,
  targetMatch: MatchRecord,
): RotationCandidateCategory | null {
  // SUPPORT paths (and BACKFILL paths, which route as SUPPORT)
  // always take priority over development.
  const supportOrBackfillPath = player.rotationPathsFromCoreTeam.find(
    (path) => path.toTeamId === targetMatch.teamId && (path.role === "SUPPORT" || path.role === "BACKFILL"),
  );
  if (supportOrBackfillPath) {
    return "SUPPORT";
  }

  // DEVELOPMENT paths (and CONFIDENCE_REBUILD paths, which route as DEVELOPMENT)
  // are gated by whether the team has development slots configured.
  if (targetMatch.team.developmentSlots > 0) {
    const devOrConfidencePath = player.rotationPathsFromCoreTeam.find(
      (path) => path.toTeamId === targetMatch.teamId && (path.role === "DEVELOPMENT" || path.role === "CONFIDENCE_REBUILD"),
    );
    if (devOrConfidencePath) {
      return "DEVELOPMENT";
    }
  }

  return null;
}