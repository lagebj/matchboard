/**
 * Weekly Coaching Context type contracts (ADR-0108, docs/domain/weekly-coaching-context.md).
 * Pure types -- no React, no Prisma. Identity is player id; display names are resolved
 * separately (see WeeklyCoachingContextResult.playerDisplayById) and never stored here.
 */

export type WeeklyContextStatus = "IN_PROGRESS" | "PROVISIONAL" | "COMPLETE";

export type WeeklyMatchSource = "LEAGUE" | "EVENT";

/** One match's presence in the week, source-tagged. Never merges League/Event meaning. */
export type WeeklyMatchRef = {
  matchId: string;
  source: WeeklyMatchSource;
  startsAt: string;
  isCancelled: boolean;
  /** True once the required report is REPORTED or LOCKED (see deriveRoundProgress's rule). */
  isReportComplete: boolean;
  hasReport: boolean;
};

export type WeeklyPlannedAbsence = {
  playerId: string;
  matchId: string;
};

export type WeeklyUnplannedAppearance = {
  playerId: string;
  matchId: string;
  source: WeeklyMatchSource;
};

export type WeeklySupportAppearance = {
  playerId: string;
  matchId: string;
  fromTeamId: string;
  toTeamId: string;
};

/**
 * The derived weekly read model. Every player/match reference is an id -- resolve display
 * names/labels via the sibling maps in WeeklyCoachingContextResult, never inline here.
 */
export type WeeklyCoachingContext = {
  weekKey: string;
  weekLabel: string;
  startsAt: string;
  endsAt: string;
  status: WeeklyContextStatus;
  leagueSeasonId: string | null;

  activity: {
    leagueMatches: WeeklyMatchRef[];
    eventMatches: WeeklyMatchRef[];
  };

  opportunity: {
    /** From computeRoundPlanIntegrity()'s AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY signals
     * for the round matching this week -- never independently recomputed. Deduplicated. Empty
     * when no round exists for this week in the given league season. */
    availableWithoutPlannedLeagueOpportunityPlayerIds: string[];
  };

  /** null when not meaningful to compute yet (status !== "COMPLETE") -- prefer omission over a
   * negative claim that an incomplete report could still change. See ADR-0108. */
  noRecordedAppearance: {
    playerIds: string[];
  } | null;

  planActual: {
    /** League-only: "planned" is a Selection concept with no Event equivalent (see domain doc). */
    plannedButAbsent: WeeklyPlannedAbsence[];
    unplannedAppearances: WeeklyUnplannedAppearance[];
  };

  movement: {
    supportAppearances: WeeklySupportAppearance[];
  };

  reporting: {
    incompleteLeagueMatchIds: string[];
    incompleteEventMatchIds: string[];
  };
};

/** `href` is org-relative (e.g. "/players/abc123"), matching the convention used throughout
 * src/lib/assistant and src/lib/situational -- resolve it through the UI layer's `useOrgUrl()`
 * (or an equivalent org-prefixing helper) at render time, never store an absolute path here. */
export type WeeklyPlayerDisplay = {
  displayName: string;
  href: string;
};

export type WeeklyMatchDisplay = {
  label: string;
  href: string;
};

/** The one thing a loader/orchestrator returns: the id-only context plus display maps built
 * once from the same already-loaded rows. UI components read the maps to resolve names/links;
 * they never resolve identity themselves. */
export type WeeklyCoachingContextResult = {
  context: WeeklyCoachingContext;
  playerDisplayById: Record<string, WeeklyPlayerDisplay>;
  matchDisplayById: Record<string, WeeklyMatchDisplay>;
};

/** True when the weekly context has nothing worth showing at all (no activity, no facts) --
 * callers should omit the surface entirely rather than render an empty card (AGENTS.md /
 * domain doc "Empty and sparse states"). */
export function isWeeklyCoachingContextEmpty(context: WeeklyCoachingContext): boolean {
  return (
    context.activity.leagueMatches.length === 0 &&
    context.activity.eventMatches.length === 0 &&
    context.opportunity.availableWithoutPlannedLeagueOpportunityPlayerIds.length === 0 &&
    (context.noRecordedAppearance === null || context.noRecordedAppearance.playerIds.length === 0) &&
    context.planActual.plannedButAbsent.length === 0 &&
    context.planActual.unplannedAppearances.length === 0 &&
    context.movement.supportAppearances.length === 0 &&
    context.reporting.incompleteLeagueMatchIds.length === 0 &&
    context.reporting.incompleteEventMatchIds.length === 0
  );
}
