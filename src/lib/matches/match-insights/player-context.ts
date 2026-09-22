import "server-only";
import { db } from "@/lib/db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { getPlayersActualPositionHistory } from "@/lib/player-development/position-usage-history";
import { getPlayersSeasonOverview } from "@/lib/players/get-players-overview";
import { getPlayerAttributeAverages } from "@/lib/player-metrics";
import type { RatingAttributeKey } from "@/lib/ratings/player-rating";
import type { MatchInsightSampleConfidence, PlayerPreparationSummary, PositionEvidenceEntry } from "./types";

/**
 * Per-player preparation summaries (ADR-0149 Decision 4; bundle §3, §5). Composes existing,
 * already-batched services — never a per-player loop, never a raw event-stream re-derivation:
 *
 * - `getPlayersActualPositionHistory()` for both position minutes/confidence AND recent starts/
 *   minutes (its `startedAtKickoff` + per-match `minutesByPosition` cover both without a second
 *   query source).
 * - `getPlayersSeasonOverview()` for season appearances/goals/assists.
 * - a direct batched `DevelopmentThread` read matching `match-prep.ts`'s existing pattern
 *   (structured `category` only — never free-text `focus`/`rationale`, per this repo's existing
 *   "no free text" doctrine for that field).
 */

const ATTRIBUTE_KEYS: readonly RatingAttributeKey[] = [
  "ballControl",
  "passing",
  "firstTouch",
  "oneVOneAttacking",
  "positioning",
  "oneVOneDefending",
  "decisionMaking",
  "effort",
  "teamplay",
  "concentration",
  "speed",
  "strength",
];

/** How many of a player's most-recent matches count toward "recent starts"/"recent minutes". */
const RECENT_MATCH_WINDOW = 5;

/** Position-minutes confidence tiers (bundle §3 example: "173 min CM -> HIGH, 65 min AM ->
 * MEDIUM"). Deliberately coarse — this is a sample-size signal, not a precision claim. */
function positionConfidence(minutes: number): MatchInsightSampleConfidence {
  if (minutes >= 150) return "HIGH";
  if (minutes >= 45) return "MEDIUM";
  return "LOW";
}

export async function buildPlayerPreparationSummaries(params: {
  playerIds: string[];
  leagueSeasonId: string;
  organisationId: string;
  orgFilter: OrgFilterMode;
}): Promise<Map<string, PlayerPreparationSummary>> {
  const result = new Map<string, PlayerPreparationSummary>();
  if (params.playerIds.length === 0) return result;

  const [players, positionHistoryByPlayer, seasonOverview, developmentThreads] = await Promise.all([
    db.player.findMany({
      where: { id: { in: params.playerIds } },
      select: {
        id: true,
        primaryPosition: true,
        secondaryPosition: true,
        tertiaryPosition: true,
        ballControl: true,
        passing: true,
        firstTouch: true,
        oneVOneAttacking: true,
        positioning: true,
        oneVOneDefending: true,
        decisionMaking: true,
        effort: true,
        teamplay: true,
        concentration: true,
        speed: true,
        strength: true,
      },
    }),
    getPlayersActualPositionHistory(params.playerIds, params.orgFilter),
    getPlayersSeasonOverview(params.leagueSeasonId, {
      orgFilter: params.orgFilter,
      playerIds: params.playerIds,
    }),
    db.developmentThread.findMany({
      where: {
        playerId: { in: params.playerIds },
        organisationId: params.organisationId,
        status: "ACTIVE",
        category: { not: null },
      },
      select: { playerId: true, category: true },
    }),
  ]);

  const seasonRowByPlayer = new Map(seasonOverview.seasonRows.map((row) => [row.playerId, row]));
  const developmentByPlayer = new Map<string, Set<string>>();
  for (const thread of developmentThreads) {
    if (!thread.category) continue;
    const existing = developmentByPlayer.get(thread.playerId);
    if (existing) existing.add(thread.category);
    else developmentByPlayer.set(thread.playerId, new Set([thread.category]));
  }

  for (const player of players) {
    const attributeRecord: Partial<Record<RatingAttributeKey, number | null>> = {};
    for (const key of ATTRIBUTE_KEYS) attributeRecord[key] = player[key];
    const averages = getPlayerAttributeAverages(attributeRecord);

    const matches = positionHistoryByPlayer.get(player.id) ?? [];

    const minutesByPosition = new Map<string, number>();
    for (const match of matches) {
      for (const [position, minutes] of Object.entries(match.minutesByPosition)) {
        minutesByPosition.set(position, (minutesByPosition.get(position) ?? 0) + minutes);
      }
    }
    const positionEvidence: PositionEvidenceEntry[] = [...minutesByPosition.entries()]
      .map(([position, minutes]) => ({
        position,
        minutes: Math.round(minutes),
        confidence: positionConfidence(minutes),
      }))
      .sort((a, b) => b.minutes - a.minutes);

    const recentMatches = matches.slice(0, RECENT_MATCH_WINDOW);
    const recentStarts = recentMatches.filter((m) => m.startedAtKickoff).length;
    const recentMinutes = Math.round(
      recentMatches.reduce((sum, m) => sum + Object.values(m.minutesByPosition).reduce((s, v) => s + v, 0), 0),
    );

    const seasonRow = seasonRowByPlayer.get(player.id);
    const developmentCategories = developmentByPlayer.get(player.id);

    result.set(player.id, {
      playerId: player.id,
      declaredPositions: {
        primary: player.primaryPosition,
        secondary: player.secondaryPosition,
        tertiary: player.tertiaryPosition,
      },
      positionEvidence,
      attributes: {
        ...attributeRecord,
        technical: averages.technical,
        tactical: averages.tactical,
        mental: averages.mental,
        physical: averages.physical,
      },
      season: {
        appearances: seasonRow?.actualAppearances ?? 0,
        goals: seasonRow?.goals ?? 0,
        assists: seasonRow?.assists ?? 0,
      },
      recent: {
        matchesConsidered: recentMatches.length,
        starts: recentStarts,
        minutes: recentMinutes,
      },
      development: developmentCategories ? [...developmentCategories].sort().map((category) => ({ category })) : [],
    });
  }

  return result;
}
