import type { EffectivePlayerPositionProfile } from "@/lib/player-development/effective-position-profile";
import type { PlayerMatchHistoryEntry } from "@/lib/players/get-player-match-history";
import type { PlayerRecentOpportunity } from "@/lib/players/get-player-recent-opportunity";
import { availabilityLabel } from "@/lib/players/availability-label";
import { exactPositionLabel } from "./exact-position-labels";
import { buildPositionMapEntries } from "./player-position-map-adapter";
import type { PlayerIdentityViewModelInput } from "./player-identity-view-model";
import type { PlayerOverviewViewModelInput, PlayerRecentMatchRow } from "./player-overview-view-model";
import type { PlayerMatchesViewModelInput } from "./player-matches-view-model";
import type { PlayerDevelopmentViewModelInput } from "./player-development-view-model";
import type { PlayerEvidenceStoryData } from "./player-evidence-view-model";
import { resolveKitColorSwatch } from "@/lib/teams/kit-color";
import { formatShortDate } from "@/lib/date-utils";

/**
 * Player Detail production adapter (Atlas Follow-up Phase F8, `04_PLAYER_DETAIL_CONTRACT.md`).
 * Maps canonical DB query results to the Phase F4 view-model input shapes — the same inputs the
 * UI Lab fixtures used, so the gate-approved components render unchanged. Pure: this module
 * never queries the database itself; the page composes queries and calls these builders
 * (contract `08_...md §1`: canonical domain state → presentation selectors → components).
 */

export type PlayerIdentitySource = {
  playerId: string;
  firstName: string;
  lastName: string | null;
  shirtNumber: number | null;
  currentAvailability: string;
  coreTeamName: string | null;
  coreTeamKitColor: string | null;
  groupLabel: string | null;
};

export function buildIdentityInput(
  player: PlayerIdentitySource,
  profile: EffectivePlayerPositionProfile,
): PlayerIdentityViewModelInput {
  return {
    playerId: player.playerId,
    firstName: player.firstName,
    lastName: player.lastName,
    shirtNumber: player.shirtNumber,
    kitColor: resolveKitColorSwatch(player.coreTeamKitColor)?.hex ?? null,
    groupLabel: player.groupLabel,
    coreTeamName: player.coreTeamName,
    currentPrimaryPosition: profile.primary ? exactPositionLabel(profile.primary) : null,
    secondaryPositions: [profile.secondary, profile.tertiary]
      .filter((p): p is string => p != null)
      .map(exactPositionLabel),
    availabilityLabel: availabilityLabel(player.currentAvailability),
    availabilityTone: availabilityTone(player.currentAvailability),
  };
}

function availabilityTone(status: string): PlayerIdentityViewModelInput["availabilityTone"] {
  if (status === "AVAILABLE") return "positive";
  if (status === "INJURED" || status === "SICK") return "attention";
  return "neutral";
}

export type PlayerOverviewSource = {
  playerId: string;
  orgSlug: string;
  seasonStats: { actualAppearances: number; goals: number; assists: number; plannedButAbsent: number };
  recentOpportunity: PlayerRecentOpportunity | null;
  profile: EffectivePlayerPositionProfile;
  activeFocus: { id: string; focus: string; category: string | null } | null;
  latestObservation: {
    id: string;
    note: string;
    createdAt: Date;
    sourceLabel: string;
    themes: string[];
  } | null;
  matchHistory: PlayerMatchHistoryEntry[];
};

export function buildOverviewInput(source: PlayerOverviewSource): PlayerOverviewViewModelInput {
  return {
    participation: {
      matches: source.seasonStats.actualAppearances,
      minutes: totalMinutes(source.matchHistory),
      starts: countStarts(source.matchHistory),
      goals: source.seasonStats.goals,
      assists: source.seasonStats.assists,
    },
    recentOpportunity: source.recentOpportunity,
    effectivePositions: buildPositionMapEntries(source.profile),
    activeDevelopmentFocus: source.activeFocus
      ? {
          id: source.activeFocus.id,
          focus: source.activeFocus.focus,
          category: source.activeFocus.category,
          // The Development tab holds the thread's own workspace; Overview just links there.
          href: `/o/${source.orgSlug}/players/${source.playerId}?tab=development`,
        }
      : null,
    latestObservation: source.latestObservation
      ? {
          id: source.latestObservation.id,
          note: source.latestObservation.note,
          createdAt: formatShortDate(source.latestObservation.createdAt),
          sourceLabel: source.latestObservation.sourceLabel,
          themes: source.latestObservation.themes,
        }
      : null,
    recentMatches: recentMatchRows(source.matchHistory, source.orgSlug),
  };
}

/**
 * Minutes/starts are summed over the queried history window (most recent 20 matches) — the
 * factual totals the canonical `ActualPositionInterval` rows actually cover, never a fabricated
 * "season total" beyond what the query returned.
 */
function totalMinutes(history: PlayerMatchHistoryEntry[]): number {
  return history.reduce((sum, m) => sum + m.minutes, 0);
}

function countStarts(history: PlayerMatchHistoryEntry[]): number {
  return history.filter((m) => m.startedAtKickoff).length;
}

function recentMatchRows(history: PlayerMatchHistoryEntry[], orgSlug: string): PlayerRecentMatchRow[] {
  return history.slice(0, 3).map((m) => ({
    matchId: m.matchKey,
    opponent: m.opponentOrEventName,
    matchDate: formatShortDate(m.playedAt),
    role:
      m.plannedRole === "CORE"
        ? "Core"
        : m.plannedRole === "SUPPORT"
          ? "Support"
          : m.plannedRole === "DEVELOPMENT"
            ? "Development"
            : null,
    goals: m.goals,
    assists: m.assists,
    href: matchHref(m, orgSlug),
  }));
}

export function matchHref(
  m: Pick<PlayerMatchHistoryEntry, "matchKey" | "source" | "eventId">,
  orgSlug: string,
): string {
  return m.source === "LEAGUE_MATCH"
    ? `/o/${orgSlug}/matches/${m.matchKey}`
    : // No standalone Event-match detail route exists — the Event detail page (Matches tab)
      // is the canonical destination for an Event match.
      m.eventId
        ? `/o/${orgSlug}/events/${m.eventId}`
        : `/o/${orgSlug}/events`;
}

export type PlayerMatchesSource = {
  orgSlug: string;
  seasonStats: { actualAppearances: number; goals: number; assists: number; plannedButAbsent: number };
  matchHistory: PlayerMatchHistoryEntry[];
};

export function buildMatchesInput(source: PlayerMatchesSource): PlayerMatchesViewModelInput {
  return {
    seasonSummary: {
      matches: source.seasonStats.actualAppearances,
      minutes: totalMinutes(source.matchHistory),
      starts: countStarts(source.matchHistory),
      goals: source.seasonStats.goals,
      assists: source.seasonStats.assists,
    },
    availableLeagueSeasons: [],
    availableEvents: [],
    matches: source.matchHistory.map((m) => ({
      matchId: m.matchKey,
      source: m.source === "LEAGUE_MATCH" ? ("LEAGUE" as const) : ("EVENT" as const),
      date: formatShortDate(m.playedAt),
      opponentOrEventName: m.opponentOrEventName,
      competitionLabel: m.source === "LEAGUE_MATCH" ? "League" : "Event",
      minutes: m.minutes,
      actualPositions: m.actualPositions,
      context: m.plannedRole,
      goals: m.goals,
      assists: m.assists,
      href: matchHref(m, source.orgSlug),
    })),
  };
}

export type PlayerDevelopmentSource = {
  playerId: string;
  activeThread: {
    id: string;
    focus: string;
    category: string | null;
    rationale: string | null;
    startedAt: Date;
    reviewState: "PENDING" | "SUPERSEDED" | "COMPLETED" | null;
    reviewDueAt: Date | null;
    observationCount: number;
  } | null;
  /** Chronological (oldest → newest) observation entries across the player's threads. */
  observations: {
    id: string;
    note: string;
    createdAt: Date;
    matchLabel: string | null;
  }[];
  completedFocusHistory: {
    id: string;
    focus: string;
    category: string | null;
    startedAt: Date;
    completedAt: Date;
  }[];
};

export function buildDevelopmentInput(source: PlayerDevelopmentSource): PlayerDevelopmentViewModelInput {
  return {
    activeFocus: source.activeThread
      ? {
          id: source.activeThread.id,
          focus: source.activeThread.focus,
          category: source.activeThread.category,
          rationale: source.activeThread.rationale,
          startedAt: formatShortDate(source.activeThread.startedAt),
          reviewState: source.activeThread.reviewState,
          reviewDueAt: source.activeThread.reviewDueAt ? formatShortDate(source.activeThread.reviewDueAt) : null,
          observationCount: source.activeThread.observationCount,
        }
      : null,
    observationTimeline: source.observations.map((o) => ({
      id: o.id,
      note: o.note,
      createdAt: formatShortDate(o.createdAt),
      matchLabel: o.matchLabel,
    })),
    positionalContextNotes: [],
    completedFocusHistory: source.completedFocusHistory.map((f) => ({
      id: f.id,
      focus: f.focus,
      category: f.category,
      startedAt: formatShortDate(f.startedAt),
      completedAt: formatShortDate(f.completedAt),
    })),
  };
}

export type PlayerEvidenceSource = {
  playerId: string;
  orgSlug: string;
  seasonStats: { actualAppearances: number; goals: number; assists: number; plannedButAbsent: number };
  recentOpportunity: PlayerRecentOpportunity | null;
  profile: EffectivePlayerPositionProfile;
  matchHistory: PlayerMatchHistoryEntry[];
};

/**
 * Evidence tab stories (contract §7): Opportunity / Position / Match context, built from the
 * same canonical facts the Overview already consumes — never a second aggregation. Confidence is
 * honest to the sample size (Emerging 3-5, Established 6+, `null` below the threshold — matching
 * `classifyMatchPhaseConfidence()`'s existing match-count vocabulary, Bundle 2 ADR-0114), never
 * invented. A story with insufficient evidence is rendered in its explicit insufficient state
 * (`confidence: null`), not omitted.
 */
export function buildEvidenceStories(source: PlayerEvidenceSource): PlayerEvidenceStoryData[] {
  const stories: PlayerEvidenceStoryData[] = [];

  if (source.recentOpportunity) {
    const o = source.recentOpportunity;
    stories.push({
      id: "opportunity-recent",
      group: "OPPORTUNITY",
      question: "Has this player had a consistent planned opportunity recently?",
      title:
        o.recentCount === o.recentTotal && o.recentTotal > 0
          ? "Planned opportunity in every recent eligible round"
          : o.recentCount > 0
            ? `Planned opportunity in ${o.recentCount} of the last ${o.recentTotal} eligible rounds`
            : "No planned opportunity in the recent eligible rounds",
      value: `${o.recentCount}/${o.recentTotal}`,
      valueCaption: "eligible rounds with a planned opportunity",
      sample: `Last ${o.recentTotal} eligible rounds`,
      confidence: o.recentTotal >= 6 ? "Established" : o.recentTotal >= 3 ? "Emerging" : null,
      sparkline: o.perRound.map((r) => (r.hadOpportunity ? 100 : 0)),
      sparklineLabels: o.perRound.map((r) => r.roundLabel),
      detailHref: `/o/${source.orgSlug}/insights/player-pathways`,
    });
  } else {
    stories.push({
      id: "opportunity-recent",
      group: "OPPORTUNITY",
      question: "Has this player had a consistent planned opportunity recently?",
      title: "Not enough recent rounds to show an opportunity pattern",
      sample: "No eligible rounds recorded yet",
      confidence: null,
      interpretation: "Rounds become eligible once the player's core team has a scheduled match in them.",
    });
  }

  const positionEntries = buildPositionMapEntries(source.profile);
  if (positionEntries.length > 0) {
    const totalMinutesRecorded = totalMinutes(source.matchHistory);
    const top = positionEntries[0];
    stories.push({
      id: "position-concentration",
      group: "POSITION",
      question: "Where does this player's actual match time concentrate?",
      title: `${top.positionLabel} leads recorded position support`,
      value: top.rank === 1 ? "Primary" : undefined,
      valueCaption: top.rank === 1 ? "current effective primary position" : undefined,
      sample: `${source.matchHistory.length} match${source.matchHistory.length === 1 ? "" : "es"} with recorded position data`,
      confidence:
        source.matchHistory.length >= 6 ? "Established" : source.matchHistory.length >= 3 ? "Emerging" : null,
      interpretation:
        totalMinutesRecorded > 0
          ? `Recorded support reflects declared positions and ${Math.round(totalMinutesRecorded)} minutes of actual playing time.`
          : "Recorded support reflects declared positions; no actual minutes have been recorded yet.",
      detailHref: `/o/${source.orgSlug}/insights/position-exposure`,
    });
  } else {
    stories.push({
      id: "position-concentration",
      group: "POSITION",
      question: "Where does this player's actual match time concentrate?",
      title: "No position evidence recorded yet",
      sample: "No completed-match positions recorded",
      confidence: null,
      interpretation: "Position support appears once the player has declared positions or recorded match time.",
    });
  }

  stories.push({
    id: "match-context-phase",
    group: "MATCH_CONTEXT",
    question: "Does this player's on-field time coincide with a particular match phase?",
    title:
      source.matchHistory.length >= 3
        ? "Match-phase patterns are available on the team's Match Timing Patterns surface"
        : "Not enough evidence yet for a match-phase pattern",
    sample: `${source.matchHistory.length} match${source.matchHistory.length === 1 ? "" : "es"} with recorded position data`,
    confidence: null,
    interpretation:
      source.matchHistory.length >= 3
        ? "Phase patterns are computed per team-season, not per player, and stay on the team's insights surface."
        : "More completed matches are needed before a phase pattern can be shown.",
  });

  return stories;
}