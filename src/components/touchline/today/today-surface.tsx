"use client";

/**
 * TodaySurface — the sole production composition owner for the Today route (ADR-0141, ADR-0142
 * "One Today composition owner", ADR-0157 §6 "Today convergence"). Replaces
 * `AssistantCommandCentrePage`'s in-place augmentation: a 9/3 operational/context-rail layout at
 * the expanded breakpoint, collapsing to one column below it
 * (`02_PRODUCTION_COMPOSITION_CONTRACT.md`).
 *
 * The main column renders exactly one of two compositions, chosen by
 * `selectTodayComposition()` from the already-resolved primary action (never a second relevance
 * score):
 *
 * - **Quiet** (`TodayQuietState`): calm hero -> compact squad readiness (only when no same-day
 *   Matchday object already shows its own) -> bounded "This week" chronology -> at most one
 *   carry-forward item. No empty Next Action / Selection decisions / Planning attention / Other
 *   attention sections.
 * - **Decision**: Next Action -> inline Why? disclosure -> Selection decisions / Planning
 *   attention / Other attention, capped to at most 2 items combined across those three sources
 *   -> Today in order -> due peer/development reviews -> the embedded peer-review list.
 *
 * Live Now / Matchday render above this switch either way — they are their own "is a match live
 * or imminent right now" state, not part of the quiet/decision choice. `InstallPwaCard` no
 * longer renders here at all (ADR-0157 §6): it remains reachable via `/more` unchanged.
 * Context rail order (desktop-only extra column; same content stacks in-flow on mobile): Since
 * your last visit -> Squad today -> Carry forward -> Recent football.
 *
 * No generic count-only round/decision summary renders here — `blocked_round`/`decision_required`
 * work-item categories are never rendered as their own card; their raw signals are shown via
 * Planning attention / Selection decisions / the primary action instead.
 */

import { getDisplayDateKey } from "@/lib/date-utils";
import type { AssistantCommandCentre } from "@/lib/assistant/types";
import { TouchlinePageHeader } from "@/components/touchline";
import type { TodaySquadStatus } from "@/lib/touchline/presentation/today-view-model";
import type { CoachSituationProjection } from "@/lib/situational/situation-types";
import type { WeeklyCoachingContextResult } from "@/lib/weekly/weekly-coaching-context-types";
import type { MatchPresentation } from "@/lib/matches/match-presentation";
import { useOrgUrl } from "@/components/shell/org-slug-context";
import { TodayAtmosphere } from "@/components/touchline/today/today-atmosphere";
import { TodayLiveNow } from "@/components/touchline/today/today-live-now";
import { TodayNextAction } from "@/components/touchline/today/today-next-action";
import { TodaySelectionDecisions, type ApplyRecommendationFn } from "@/components/touchline/today/today-selection-decisions";
import { TodayPlanningAttention } from "@/components/touchline/today/today-planning-attention";
import { selectTodayPlanningAttentionSignals } from "@/lib/touchline/presentation/today-planning-attention";
import { TodayOtherAttention, selectTodayOtherAttentionItems } from "@/components/touchline/today/today-other-attention";
import { TodayOperationalTimeline } from "@/components/touchline/today/today-operational-timeline";
import { TodayContextRail } from "@/components/touchline/today/today-context-rail";
import { DueDecisionReviewSection } from "@/components/assistant/due-decision-review-section";
import { resolveTodayPrimaryAction } from "@/lib/touchline/presentation/today-primary-action";
import { workItemIdFromCandidateId } from "@/lib/situational/providers/assistant-candidate-provider";
import { idempotencyKeyFromCandidateId } from "@/lib/situational/providers/plan-integrity-candidate-provider";
import type { TodaySelectionDecision } from "@/lib/touchline/presentation/today-selection-recommendation-plan";
import type { TodayLiveNowResult } from "@/lib/live-match/get-today-live-match-summaries";
import type { TodayVisitCurrentFacts } from "@/lib/touchline/presentation/today-visit-snapshot";
import type { TodayCarryForwardItem } from "@/lib/touchline/presentation/today-carry-forward";
import { TodayMatchday } from "@/components/touchline/today/today-matchday";
import type { TodayMatchdayContext } from "@/lib/touchline/get-today-football-matches";
import { resolveTodayMatchdayAction } from "@/lib/touchline/presentation/today-matchday-readiness";
import { resolveTodayMatchdayPhase } from "@/lib/touchline/presentation/today-matchday-phase";
import {
  selectTodayComposition,
  buildTodayDecisionWhyContent,
  selectTodayWeekChronologyItems,
} from "@/lib/touchline/presentation/today-composition";
import { TodayQuietState } from "@/components/touchline/today/today-quiet-state";
import { TodayDecisionWhy } from "@/components/touchline/today/today-decision-why";
import type { PlanIntegritySignal } from "@/lib/selection/compute-plan-integrity";
import type { AssistantWorkItem } from "@/lib/assistant/types";

/** ADR-0157 §6 "At most two secondary items that are also actionable now" — a bounded,
 * priority-preserving cap across the three existing secondary sources (selection decisions,
 * planning attention, other attention), never a new ranking: each source keeps its own current
 * relative order, and the cap is a plain `slice`, not a re-sort. */
const MAX_DECISION_DAY_SECONDARY_ITEMS = 2;

type SecondaryCandidate =
  | { kind: "SELECTION"; item: TodaySelectionDecision }
  | { kind: "PLANNING"; item: PlanIntegritySignal }
  | { kind: "OTHER"; item: AssistantWorkItem };

function capSecondaryItems(
  selection: TodaySelectionDecision[],
  planning: PlanIntegritySignal[],
  other: AssistantWorkItem[],
): { selection: TodaySelectionDecision[]; planning: PlanIntegritySignal[]; other: AssistantWorkItem[] } {
  const candidates: SecondaryCandidate[] = [
    ...selection.map((item): SecondaryCandidate => ({ kind: "SELECTION", item })),
    ...planning.map((item): SecondaryCandidate => ({ kind: "PLANNING", item })),
    ...other.map((item): SecondaryCandidate => ({ kind: "OTHER", item })),
  ].slice(0, MAX_DECISION_DAY_SECONDARY_ITEMS);

  return {
    selection: candidates.filter((c): c is { kind: "SELECTION"; item: TodaySelectionDecision } => c.kind === "SELECTION").map((c) => c.item),
    planning: candidates.filter((c): c is { kind: "PLANNING"; item: PlanIntegritySignal } => c.kind === "PLANNING").map((c) => c.item),
    other: candidates.filter((c): c is { kind: "OTHER"; item: AssistantWorkItem } => c.kind === "OTHER").map((c) => c.item),
  };
}

function isActionable(item: AssistantCommandCentre["items"][number]): boolean {
  return item.category !== "upcoming_round";
}

export function TodaySurface({
  commandCentre,
  projection,
  weeklyContext: _weeklyContext,
  recentMatches,
  squadStatus,
  liveNow,
  selectionDecisions,
  applyRecommendation,
  sinceLastVisitScope,
  sinceLastVisitFacts,
  carryForwardItems,
  matchdayContext,
  upcomingMatches,
  children,
}: {
  commandCentre: AssistantCommandCentre;
  projection?: CoachSituationProjection;
  /** Kept as a prop for API continuity, but no longer rendered directly on Today — see
   * `carryForwardItems` (the ADR-0142 compact adapter's output) instead. */
  weeklyContext?: WeeklyCoachingContextResult;
  recentMatches?: MatchPresentation[];
  squadStatus?: TodaySquadStatus | null;
  liveNow?: TodayLiveNowResult;
  selectionDecisions: TodaySelectionDecision[];
  applyRecommendation: ApplyRecommendationFn;
  sinceLastVisitScope?: string;
  sinceLastVisitFacts?: TodayVisitCurrentFacts;
  carryForwardItems: TodayCarryForwardItem[];
  /** The one deterministically featured same-day match and its readiness (ADR-0143) — null
   * when Live Now already owns the anchor, or there is no eligible same-day match at all. */
  matchdayContext?: TodayMatchdayContext;
  /** Bounded, forward-looking (ADR-0157 §6) — feeds the quiet-day "This week" chronology only. */
  upcomingMatches?: MatchPresentation[];
  /** Server-rendered trailing sections — the embedded peer-review list (ADR-0157 C8). Null-safe:
   * Today never renders empty sections. */
  children?: React.ReactNode;
}) {
  const orgUrl = useOrgUrl();
  const { items, leagueSeasonName } = commandCentre;
  const actionable = items.filter(isActionable);
  const nowIso = new Date().toISOString();

  const matchdayPhase = matchdayContext
    ? resolveTodayMatchdayPhase({
        nowIso,
        startsAtIso: matchdayContext.featured.startsAt,
        lifecycleStatus: matchdayContext.featured.lifecycleStatus,
        hasActiveLiveSession: matchdayContext.featured.hasActiveLiveSession,
        canEnterLiveReporting: matchdayContext.featured.liveEntryHref != null,
      }).phase
    : null;

  // Every readiness/review action Matchday offers points at the match/event's own canonical
  // detail page and the same live-entry route Live Now's own "Follow live" action already uses —
  // no second lineup/availability/live-start route is introduced (ADR-0143).
  const matchdayAction =
    matchdayContext && matchdayPhase
      ? resolveTodayMatchdayAction({
          phase: matchdayPhase,
          readiness: matchdayContext.readiness,
          canEnterLiveReporting: matchdayContext.featured.liveEntryHref != null,
          startLiveHref: matchdayContext.featured.liveEntryHref ?? matchdayContext.featured.href,
          reviewHref: matchdayContext.featured.href,
          availabilityReviewHref: matchdayContext.featured.href,
          lineupReviewHref: matchdayContext.featured.href,
        })
      : null;

  const matchdayConsumedSignalId = matchdayAction?.consumedSignalId ?? null;

  const primaryAction = resolveTodayPrimaryAction({
    projectionDecisions: projection?.decisions ?? [],
    selectionDecisions,
    roundPlanIntegrities: commandCentre.roundPlanIntegrities,
    todayMatches: commandCentre.todayMatches,
    excludedCandidateIds: matchdayConsumedSignalId
      ? new Set(
          (projection?.decisions ?? [])
            .filter((d) => idempotencyKeyFromCandidateId(d.candidateId) === matchdayConsumedSignalId)
            .map((d) => d.candidateId),
        )
      : undefined,
  });

  // Exclude whichever signal/decision was promoted to the primary action from the lower
  // full-detail sections, to avoid duplication (ADR-0142 "Primary-action resolution correction").
  const promotedSelectionSignalKey = primaryAction.kind === "SELECTION_DECISION" ? primaryAction.decision.signalKey : null;
  const promotedPlanIntegrityKey = primaryAction.kind === "PLAN_INTEGRITY_SIGNAL" ? primaryAction.signal.idempotencyKey : null;
  const promotedWorkItemId =
    primaryAction.kind === "GENERIC" ? workItemIdFromCandidateId(primaryAction.decision.candidateId) : null;

  const remainingSelectionDecisions = selectionDecisions.filter(
    (d) => d.signalKey !== promotedSelectionSignalKey && d.signalKey !== matchdayConsumedSignalId,
  );
  const excludedFromPlanningAttention = new Set<string>(
    [promotedPlanIntegrityKey, matchdayConsumedSignalId].filter((key): key is string => Boolean(key)),
  );
  const planningAttentionSignals = selectTodayPlanningAttentionSignals(
    commandCentre.roundPlanIntegrities,
    excludedFromPlanningAttention,
  );

  const otherAttentionExcludeIds = new Set<string>(promotedWorkItemId ? [promotedWorkItemId] : []);
  const otherAttentionItems = selectTodayOtherAttentionItems(actionable, otherAttentionExcludeIds);

  // The match Live Now or Matchday already owns must not also appear as still-unaddressed lower
  // chronology (ADR-0143 §4.5/§4.7) — Event matches never appear in this League-only timeline, so
  // only a League-sourced featured match needs excluding here.
  const timelineExcludedMatchId =
    liveNow?.primary?.matchId ??
    (matchdayContext?.featured.source === "LEAGUE" ? matchdayContext.featured.id : null);

  const hasContextRailContent = Boolean(
    (sinceLastVisitScope && sinceLastVisitFacts) ||
      squadStatus ||
      carryForwardItems.length > 0 ||
      (recentMatches && recentMatches.length > 0),
  );

  const compositionState = selectTodayComposition(primaryAction, commandCentre.dueDecisionReviews.length > 0);
  const cappedSecondary = capSecondaryItems(remainingSelectionDecisions, planningAttentionSignals, otherAttentionItems);
  const weekChronologyItems = selectTodayWeekChronologyItems({
    upcomingMatches: upcomingMatches ?? [],
    dueDecisionReviews: commandCentre.dueDecisionReviews,
  });
  const decisionWhyContent = buildTodayDecisionWhyContent(primaryAction);
  const quietHero =
    projection?.status === "LIVE"
      ? { title: "Nothing else needs your attention right now.", description: "Follow the live match above, or open Fixtures to plan ahead." }
      : { title: "Nothing needs your attention.", description: "Upcoming rounds are under control. Open Fixtures to plan ahead." };

  return (
    <div className="touchline relative isolate flex flex-col gap-6">
      <TodayAtmosphere />
      <div className="relative z-10 flex flex-col gap-6">
        <TouchlinePageHeader
          title="Today"
          context={leagueSeasonName ?? "What needs attention before the next matches."}
        />

        {liveNow?.primary ? (
          <TodayLiveNow
            primary={liveNow.primary}
            otherLiveCount={liveNow.otherLiveCount}
            matchHref={(matchId) => orgUrl(`/matches/${matchId}/live/follow`)}
            reportHref={(matchId) => orgUrl(`/matches/${matchId}/live`)}
          />
        ) : (
          matchdayContext &&
          matchdayAction && (
            <TodayMatchday
              match={matchdayContext.featured}
              readiness={matchdayContext.readiness}
              action={matchdayAction}
              nowIso={nowIso}
            />
          )
        )}

        <div className={hasContextRailContent ? "grid grid-cols-1 gap-5 expanded:grid-cols-12" : ""}>
          <div className={hasContextRailContent ? "flex flex-col gap-5 expanded:col-span-9" : "flex flex-col gap-5"}>
            {compositionState === "QUIET" ? (
              <TodayQuietState
                heroTitle={quietHero.title}
                heroDescription={quietHero.description}
                showSquadReadiness={!matchdayContext}
                squadStatus={squadStatus}
                weekChronologyItems={weekChronologyItems}
                carryForwardItems={carryForwardItems}
              />
            ) : (
              <>
                <div className="flex flex-col gap-0">
                  <TodayNextAction
                    action={primaryAction}
                    status={projection?.status}
                    scope={sinceLastVisitScope ?? "default"}
                    displayDateKey={getDisplayDateKey()}
                    onApply={applyRecommendation}
                    roundBoardBaseHref={orgUrl("/rounds")}
                    orgUrl={orgUrl}
                  />
                  <TodayDecisionWhy content={decisionWhyContent} />
                </div>

                <TodaySelectionDecisions
                  decisions={cappedSecondary.selection}
                  scope={sinceLastVisitScope ?? "default"}
                  displayDateKey={getDisplayDateKey()}
                  onApply={applyRecommendation}
                  roundBoardBaseHref={orgUrl("/rounds")}
                />

                <TodayPlanningAttention signals={cappedSecondary.planning} orgUrl={orgUrl} />

                <TodayOtherAttention items={cappedSecondary.other} />

                <TodayOperationalTimeline
                  matches={commandCentre.todayMatches}
                  orgUrl={orgUrl}
                  excludedMatchId={timelineExcludedMatchId}
                />

                <DueDecisionReviewSection reviews={commandCentre.dueDecisionReviews} />

                {/* ADR-0157 slice C8: the retired `/reviews` hub's job lives here now — the
                    server-rendered peer-review list (due work, resolve/cancel, resolved
                    history), passed as children by the Today route. Renders nothing when
                    there is no peer-review activity. */}
                {children}
              </>
            )}
          </div>

          {hasContextRailContent && (
            <div className="expanded:col-span-3">
              <TodayContextRail
                sinceLastVisitScope={sinceLastVisitScope}
                sinceLastVisitFacts={sinceLastVisitFacts}
                squadStatus={squadStatus}
                carryForwardItems={carryForwardItems}
                recentMatches={recentMatches}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
