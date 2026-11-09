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
 * - **Quiet** (`TodayQuietState`): calm hero (only when no same-day Matchday object already shows
 *   a genuine operational action above it — P1-01 remediation: an unconditional "Nothing needs
 *   your attention" message directly contradicts a real Matchday action on the same screen) ->
 *   compact squad readiness (only when no same-day Matchday object already shows its own) ->
 *   bounded "This week" chronology -> at most one carry-forward item. No empty Next Action /
 *   Selection decisions / Planning attention / Other attention sections.
 * - **Decision**: Next Action -> inline Why? disclosure -> Selection decisions / Planning
 *   attention / Other attention, capped to at most 2 items combined across those three sources
 *   -> due peer/development reviews -> the embedded peer-review list.
 *
 * "Today in order" (`TodayOperationalTimeline`) is orthogonal to the quiet/decision switch
 * itself (P1-02 remediation): it renders whenever there is a decision OR a same-day Matchday
 * object to show other same-day football alongside — never only on decision days, and never a
 * second ranking of which match matters (the already-excluded `timelineExcludedMatchId` is
 * unchanged either way).
 *
 * Live Now / Matchday render above this switch either way — they are their own "is a match live
 * or imminent right now" state, not part of the quiet/decision choice. `InstallPwaCard` no
 * longer renders here at all (ADR-0157 §6): it remains reachable via `/more` unchanged.
 * Context rail order (desktop-only extra column; same content stacks in-flow on mobile): Since
 * your last visit -> Squad today -> Carry forward -> Recent football. P1-03/P1-04/P1-05
 * remediation: each fact is shown in exactly one place, never twice, and never silently dropped
 * — deduplication must preserve meaning, not merely reduce how many widgets render.
 * - **Squad today** (organisation-wide active-player availability, `getOrgActivePlayerAvailability()`)
 *   is a different scope from Matchday's own match-specific readiness (who's selected for THIS
 *   match) — both can be true and useful at once. The rail omits it only when the quiet-day
 *   hero is already showing the identical org-wide fact inline (no Matchday anchor); whenever a
 *   Matchday anchor exists, the rail keeps showing it (with a scope label, since Matchday's own
 *   card is also on the page) rather than disappearing.
 * - **Carry forward**: the quiet-day composition features at most one item inline (unchanged);
 *   the rail owns the *rest* of the collection (2nd, 3rd item) whenever the day is quiet, rather
 *   than discarding them — a prior pass suppressed the rail's whole collection instead of just
 *   its first item, which silently dropped real information.
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
  nowIso: nowIsoProp,
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
  /** P2-01 remediation: an explicit clock injection point so a caller that has already resolved
   * "now" once (deterministic UI Lab fixtures; eventually the situational projection's own
   * `nowIso`) can make this component's rendering reproducible, instead of this component
   * independently calling `new Date()` a second time. Omitted in production today — preserves
   * exact existing behavior. */
  nowIso?: string;
}) {
  const orgUrl = useOrgUrl();
  const { items, leagueSeasonName } = commandCentre;
  const actionable = items.filter(isActionable);
  const nowIso = nowIsoProp ?? new Date().toISOString();

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

  const compositionState = selectTodayComposition(primaryAction, commandCentre.dueDecisionReviews.length > 0);

  // P1-03 remediation (narrowed by P1-04/P1-05 — a prior pass over-suppressed the context rail
  // and lost real information; this is the corrected version):
  //
  // Squad readiness: `squadStatus` (`TodaySquadStatus`, from `getOrgActivePlayerAvailability()`)
  // is an ORGANISATION-WIDE active-player snapshot — a different scope from
  // `matchdayContext.readiness`'s own SELECTED-for-this-match readiness
  // (`formatSquadPlannedLine()`/`formatSelectedAvailabilityLine()`, rendered inside
  // `TodayMatchday`'s own card). The two are both true at once, not duplicates — "31 available
  // org-wide" and "10 selected players available" answer different questions. The quiet-day
  // composition's own inline `SquadReadinessWidget` (`showSquadReadiness` below) is the only
  // place that genuinely repeats this exact org-wide fact, so the context rail suppresses only
  // that one case, never whenever a Matchday anchor exists.
  //
  // Carry-forward: the quiet-day composition features at most one item inline
  // (`TodayQuietState`'s own `.slice(0, 1)`, unchanged) — it does not own the rest of the
  // collection. The context rail is the one place any further items (2nd, 3rd) are still
  // reachable; suppressing the whole collection there (a prior pass's mistake) silently dropped
  // them from the page instead of deduplicating anything.
  const showSquadReadiness = !matchdayContext;
  const squadStatusShownInline = compositionState === "QUIET" && showSquadReadiness;
  const contextRailSquadStatus = squadStatusShownInline ? null : squadStatus ?? null;
  const contextRailCarryForwardItems = compositionState === "QUIET" ? carryForwardItems.slice(1) : carryForwardItems;

  const hasContextRailContent = Boolean(
    (sinceLastVisitScope && sinceLastVisitFacts) ||
      contextRailSquadStatus ||
      contextRailCarryForwardItems.length > 0 ||
      (recentMatches && recentMatches.length > 0),
  );
  // P1-01/P1-02 remediation: Matchday owning the primary anchor is an orthogonal fact to the
  // quiet/decision switch above (that switch is about situational decisions only, never
  // re-derived here) — so "today's other football" stays visible whenever Matchday has a
  // genuine same-day match to show, not only on decision days. Never a second ranking: the same
  // already-excluded `timelineExcludedMatchId` applies either way.
  const showOperationalTimeline = compositionState === "DECISION" || Boolean(matchdayContext);
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
            matchHref={(matchId) =>
              liveNow.primary!.kind === "EVENT"
                ? orgUrl(`/events/${liveNow.primary!.eventId}/matches/${matchId}/live/follow`)
                : orgUrl(`/matches/${matchId}/live/follow`)
            }
            reportHref={(matchId) =>
              liveNow.primary!.kind === "EVENT"
                ? orgUrl(`/events/${liveNow.primary!.eventId}/matches/${matchId}/live`)
                : orgUrl(`/matches/${matchId}/live`)
            }
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
                showHero={!matchdayContext}
                showSquadReadiness={showSquadReadiness}
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
              </>
            )}

            {showOperationalTimeline && (
              <TodayOperationalTimeline
                matches={commandCentre.todayMatches}
                orgUrl={orgUrl}
                excludedMatchId={timelineExcludedMatchId}
              />
            )}

            {compositionState === "DECISION" && (
              <>
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
                squadStatus={contextRailSquadStatus}
                // P1-04: when Matchday's own card already shows match-specific readiness above,
                // an unlabelled "X available" here could read as the same fact restated — a
                // concise scope label (the existing widget's own `title` override, no new
                // widget) makes clear this is the organisation-wide count, not the featured
                // match's selected squad.
                squadStatusTitle={matchdayContext ? "All active players" : undefined}
                carryForwardItems={contextRailCarryForwardItems}
                recentMatches={recentMatches}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
