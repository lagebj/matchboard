import type { AutomaticSelectionCategory } from "@/lib/selection/types";
import type { MatchRecord, PathDestination, PlayerRecord, RotationCandidateCategory } from "@/lib/selection/selection-types";

export function getSuitabilityAndReadinessScore(
  player: PlayerRecord,
  candidateCategory: RotationCandidateCategory,
): number {
  if (candidateCategory === "SUPPORT") {
    if (player.supportSuitability === "strong") return 15;
    if (player.supportSuitability === "avoid") return -25;
    return 0;
  }

  if (candidateCategory === "DEVELOPMENT") {
    if (player.developmentReadiness === "ready") return 10;
    return 0;
  }

  return 0;
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

  if (candidateCategory === "BACKFILL") {
    return "BACKFILL";
  }

  if (candidateCategory === "CONFIDENCE_REBUILD") {
    return "CONFIDENCE_REBUILD";
  }

  return "DEVELOPMENT";
}

export function getPathBasedCategory(
  player: PlayerRecord,
  targetMatch: MatchRecord,
): RotationCandidateCategory {
  if (targetMatch.supportSourceTeamIds.includes(player.coreTeamId)) {
    const supportPath = player.rotationPathsFromCoreTeam.find(
      (path) => path.toTeamId === targetMatch.teamId && path.role === "SUPPORT",
    );
    if (supportPath) {
      return "SUPPORT";
    }
  }

  if (
    targetMatch.team.developmentSlots > 0 &&
    targetMatch.developmentSourceTeamIds.includes(player.coreTeamId)
  ) {
    const devPath = player.rotationPathsFromCoreTeam.find(
      (path) => path.toTeamId === targetMatch.teamId && path.role === "DEVELOPMENT",
    );
    if (devPath) {
      return "DEVELOPMENT";
    }
  }

  const anyPath = player.rotationPathsFromCoreTeam.find(
    (path) => path.toTeamId === targetMatch.teamId,
  );
  if (anyPath) {
    if (anyPath.role === "SUPPORT") return "SUPPORT";
    if (anyPath.role === "DEVELOPMENT") return "DEVELOPMENT";
    if (anyPath.role === "CONFIDENCE_REBUILD") return "CONFIDENCE_REBUILD";
    if (anyPath.role === "BACKFILL") return "BACKFILL";
  }

  if (targetMatch.supportSourceTeamIds.includes(player.coreTeamId)) {
    return "SUPPORT";
  }

  if (
    targetMatch.team.developmentSlots > 0 &&
    targetMatch.developmentSourceTeamIds.includes(player.coreTeamId)
  ) {
    return "DEVELOPMENT";
  }

  return "DEVELOPMENT";
}