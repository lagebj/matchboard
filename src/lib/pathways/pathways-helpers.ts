import type {
  PathwayCellStatus,
  PathwayContext,
  SelectionOutcome,
  PlayerPathwayRow,
  PathwaySummaryMetrics,
  PathwayCell,
} from "./pathways-types";

export function mapSelectionRoleToPathwayContext(role: string): PathwayContext {
  switch (role) {
    case "CORE":
      return "core";
    case "SUPPORT":
      return "support";
    case "DEVELOPMENT":
      return "development";
    case "BACKFILL":
      return "squad_repair";
    case "CONFIDENCE_REBUILD":
      return "development";
    case "CORE_MATCH_DROP":
      return "core_match_drop";
    default:
      return "unknown";
  }
}

export function mapSelectionRoleToCellStatus(
  role: string,
  isDraft: boolean,
  isHomeTeam: boolean,
): PathwayCellStatus {
  if (isDraft) {
    switch (role) {
      case "CORE":
        return "draft_core";
      case "SUPPORT":
        return "draft_support";
      case "DEVELOPMENT":
      case "CONFIDENCE_REBUILD":
        return "draft_development";
      case "BACKFILL":
        return "draft_squad_repair";
      case "CORE_MATCH_DROP":
        return "draft_core_match_drop";
      default:
        return "draft_core";
    }
  }

  switch (role) {
    case "CORE":
      return isHomeTeam ? "core_home" : "core_home";
    case "SUPPORT":
      return "support_sent";
    case "DEVELOPMENT":
    case "CONFIDENCE_REBUILD":
      return "development_moved";
    case "BACKFILL":
      return "squad_repair_received";
    case "CORE_MATCH_DROP":
      return "core_match_drop";
    default:
      return "no_data";
  }
}

export function deriveSelectionOutcome(
  role: string,
  hasActualParticipation: boolean,
  availabilityStatus: string,
): SelectionOutcome {
  if (availabilityStatus === "UNAVAILABLE") return "unavailable";
  if (availabilityStatus === "DECLINED") return "declined";
  if (role === "not_selected") return "not_selected";

  if (hasActualParticipation) return "played";
  return "selected_no_minutes";
}

export function computePathwaySummaryMetrics(
  players: PlayerPathwayRow[],
): PathwaySummaryMetrics {
  let temporarySupportAppearances = 0;
  let playersWithNoCompletedOpportunity = 0;
  let playersInMultipleContexts = 0;

  const supportCounts = new Map<string, { playerId: string; playerName: string; supportCount: number }>();

  for (const player of players) {
    if (player.supportAppearances > 0) {
      temporarySupportAppearances += player.supportAppearances;
      supportCounts.set(player.playerId, {
        playerId: player.playerId,
        playerName: player.playerName,
        supportCount: player.supportAppearances,
      });
    }

    if (player.roundsPlayed === 0) {
      playersWithNoCompletedOpportunity++;
    }

    const contexts = new Set<string>();
    for (const cell of player.cells) {
      if (cell.context !== "unknown") {
        contexts.add(cell.context);
      }
    }
    if (contexts.size > 1) {
      playersInMultipleContexts++;
    }
  }

  const sorted = Array.from(supportCounts.values()).sort((a, b) => b.supportCount - a.supportCount);
  const mostFrequentHelpers = sorted.slice(0, 5);

  return {
    playersShown: players.length,
    temporarySupportAppearances,
    playersWithNoCompletedOpportunity,
    playersInMultipleContexts,
    mostFrequentHelpers,
  };
}

export function getContextLabel(context: PathwayContext): string {
  switch (context) {
    case "core":
      return "Core";
    case "support":
      return "Support";
    case "development":
      return "Development";
    case "squad_repair":
      return "Squad repair";
    case "core_match_drop":
      return "Core match drop";
    case "unknown":
      return "Unknown";
    default:
      return context;
  }
}

export function getCellStatusLabel(status: PathwayCellStatus): string {
  switch (status) {
    case "core_home":
      return "Core";
    case "support_sent":
      return "Support";
    case "development_moved":
      return "Development";
    case "squad_repair_received":
      return "Squad repair";
    case "core_match_drop":
      return "Dropped";
    case "not_selected":
      return "Not selected";
    case "unavailable":
      return "Unavailable";
    case "cancelled":
      return "Cancelled";
    case "draft_core":
      return "Core (draft)";
    case "draft_support":
      return "Support (draft)";
    case "draft_development":
      return "Development (draft)";
    case "draft_squad_repair":
      return "Squad repair (draft)";
    case "draft_core_match_drop":
      return "Dropped (draft)";
    case "no_data":
      return "—";
    default:
      return status;
  }
}

export function isDraftCell(cell: PathwayCell): boolean {
  return cell.isDraft;
}

export function isFinalizedCell(cell: PathwayCell): boolean {
  return !cell.isDraft;
}

export function isSupportCell(cell: PathwayCell): boolean {
  return cell.context === "support";
}

export function isDevelopmentCell(cell: PathwayCell): boolean {
  return cell.context === "development";
}