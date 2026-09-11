/**
 * Today presentation view model (Touchline Design Atlas, `02_REFERENCE_TO_CODE_METHOD.md §2`,
 * `05_ROUTE_COMPOSITION_TODAY_LEAGUE_HISTORY.md §A`).
 *
 * Pure, DB-free, serializable. The route/page loads canonical data (unchanged) and passes
 * already-typed slices in; this module only decides hero selection, squad-status counting, and
 * ordering — it never queries the database and never invents data.
 *
 * Sources:
 * - todayMatches            -> EXISTING_DIRECT   (AssistantCommandCentre.todayMatches, src/lib/assistant/get-assistant-command-centre.ts)
 * - matchPresentations      -> EXISTING_DIRECT   (built by the route via buildMatchPresentation() per todayMatches entry)
 * - decisions               -> EXISTING_DIRECT   (CoachSituationProjection.decisions, src/lib/situational/get-coach-situation-projection.ts)
 * - dueDecisionReviews       -> EXISTING_DIRECT   (AssistantCommandCentre.dueDecisionReviews)
 * - recentMatches           -> EXISTING_DIRECT   (MatchPresentation[] from finalized/reported matches, own-team perspective)
 * - scheduleItems           -> EXISTING_DIRECT   (WeeklyCoachingContext.activity + todayMatches, mapped to a common shape by the route)
 * - squadStatus.players     -> EXISTING_QUERYABLE (Player.currentAvailability for the relevant core team/round context)
 * - evidenceSpotlight       -> EXISTING_QUERYABLE (getTeamSeasonMatchPhasePatterns() — one opening/closing-phase story)
 * Derived:
 * - heroKind                -> DERIVED_PRESENTATION (a blocking decision outranks the next match)
 * - squadStatus counts       -> DERIVED_PRESENTATION (grouped from player availability)
 * - attentionItems (max 4)   -> DERIVED_PRESENTATION (slice of decisions, remainder counted)
 */

import type { MatchPresentation } from "@/lib/matches/match-presentation";

export type TodayAvailability = "AVAILABLE" | "UNAVAILABLE" | "INJURED" | "SICK" | "AWAY" | "TENTATIVE" | "UNKNOWN";

export interface TodayPlayerAvailabilityInput {
  playerId: string;
  displayName: string;
  availability: TodayAvailability;
}

export interface TodayDecisionInput {
  id: string;
  title: string;
  summary?: string;
  urgency: "IMMEDIATE" | "SOON" | "NORMAL" | "LOW";
  visibility: "PROMOTE" | "NORMAL" | "DEFER" | "SUPPRESS";
  deepLink?: string;
  recommendedActionLabel?: string;
  /** Passthrough of `CoachDecision.candidateId` — this view-model never interprets it, but a
   * caller that also needs to correlate the hero decision back to its underlying
   * `AssistantWorkItem` (e.g. to exclude it from a grouped work-item list rendered elsewhere on
   * the same page, avoiding showing the same item twice) needs it available. */
  candidateId?: string;
}

export interface TodayScheduleItemInput {
  id: string;
  timeLabel: string | null;
  title: string;
  sublabel?: string;
  isNow?: boolean;
  isMatch?: boolean;
  href?: string;
}

export interface TodayDueDecisionReviewInput {
  reviewId: string;
  label: string;
  targetName: string;
  targetHref: string;
}

export interface TodayEvidenceSpotlightInput {
  question: string;
  label: string;
  title: string;
  value?: string;
  valueCaption?: string;
  sample: string;
  confidence: "INSUFFICIENT" | "EMERGING" | "ESTABLISHED" | null;
  interpretation?: string;
  detailHref?: string;
  phaseSegments?: { label: string; value: number; highlighted?: boolean }[];
}

export interface TodayViewModelInput {
  dateLabel: string;
  nextMatch: MatchPresentation | null;
  decisions: TodayDecisionInput[];
  dueDecisionReviews: TodayDueDecisionReviewInput[];
  recentMatches: MatchPresentation[];
  scheduleItems: TodayScheduleItemInput[];
  squadStatusPlayers: TodayPlayerAvailabilityInput[] | null;
  evidenceSpotlight: TodayEvidenceSpotlightInput | null;
}

export interface TodaySquadStatus {
  available: number;
  doubtful: number;
  unavailable: number;
  notAvailable: { playerId: string; displayName: string; reason: string }[];
}

export type TodayHeroKind = "attention" | "match" | "none";

export interface TodayViewModel {
  dateLabel: string;
  heroKind: TodayHeroKind;
  heroMatch: MatchPresentation | null;
  heroDecision: TodayDecisionInput | null;
  attentionItems: TodayDecisionInput[];
  attentionOverflowCount: number;
  dueDecisionReviews: TodayDueDecisionReviewInput[];
  recentMatches: MatchPresentation[];
  scheduleItems: TodayScheduleItemInput[];
  squadStatus: TodaySquadStatus | null;
  evidenceSpotlight: TodayEvidenceSpotlightInput | null;
}

const AVAILABILITY_LABEL: Record<Exclude<TodayAvailability, "AVAILABLE">, string> = {
  UNAVAILABLE: "Unavailable",
  INJURED: "Injured",
  SICK: "Illness",
  AWAY: "Away",
  TENTATIVE: "Questionable",
  UNKNOWN: "Unknown",
};

const ATTENTION_VISIBLE_MAX = 4;

/**
 * The most urgent non-suppressed, non-deferred decision becomes the hero when it is blocking
 * (IMMEDIATE urgency) — otherwise the next match is the hero and the decision moves into the
 * attention list. This matches `05§A`: "AttentionHero if a blocking item is more urgent."
 */
export function buildTodayViewModel(input: TodayViewModelInput): TodayViewModel {
  const visibleDecisions = input.decisions.filter(
    (d) => d.visibility === "PROMOTE" || d.visibility === "NORMAL",
  );
  const blockingDecision = visibleDecisions.find((d) => d.urgency === "IMMEDIATE") ?? null;

  const heroKind: TodayHeroKind = blockingDecision ? "attention" : input.nextMatch ? "match" : "none";
  const heroDecision = heroKind === "attention" ? blockingDecision : null;
  const heroMatch = heroKind === "match" ? input.nextMatch : null;

  const remainingDecisions = visibleDecisions.filter((d) => d.id !== blockingDecision?.id);
  const attentionItems = remainingDecisions.slice(0, ATTENTION_VISIBLE_MAX);
  const attentionOverflowCount = Math.max(0, remainingDecisions.length - attentionItems.length);

  const squadStatus = input.squadStatusPlayers ? summarizeSquadStatus(input.squadStatusPlayers) : null;

  return {
    dateLabel: input.dateLabel,
    heroKind,
    heroMatch,
    heroDecision,
    attentionItems,
    attentionOverflowCount,
    dueDecisionReviews: input.dueDecisionReviews,
    recentMatches: input.recentMatches,
    scheduleItems: input.scheduleItems,
    squadStatus,
    evidenceSpotlight: input.evidenceSpotlight,
  };
}

export function summarizeSquadStatus(players: TodayPlayerAvailabilityInput[]): TodaySquadStatus {
  let available = 0;
  let doubtful = 0;
  let unavailable = 0;
  const notAvailable: TodaySquadStatus["notAvailable"] = [];

  for (const p of players) {
    if (p.availability === "AVAILABLE") {
      available += 1;
      continue;
    }
    if (p.availability === "TENTATIVE") {
      doubtful += 1;
    } else {
      unavailable += 1;
    }
    notAvailable.push({
      playerId: p.playerId,
      displayName: p.displayName,
      reason: AVAILABILITY_LABEL[p.availability],
    });
  }

  return { available, doubtful, unavailable, notAvailable };
}
