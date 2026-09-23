"use client";

/**
 * TodaySurface — the sole production composition owner for the Today route (ADR-0141, ADR-0142
 * "One Today composition owner"). Replaces `AssistantCommandCentrePage`'s in-place augmentation:
 * a 9/3 operational/context-rail layout at the expanded breakpoint, collapsing to one column
 * below it (`02_PRODUCTION_COMPOSITION_CONTRACT.md`).
 *
 * Main column order: Live Now -> Next Action -> Selection decisions -> Planning attention ->
 * Other attention -> Today in order -> (Ready to revisit / peer-review link / PWA install).
 * Context rail order: Since your last visit -> Squad today -> Carry forward -> Recent football.
 *
 * No generic count-only round/decision summary renders here — `blocked_round`/`decision_required`
 * work-item categories are never rendered as their own card; their raw signals are shown via
 * Planning attention / Selection decisions / the primary action instead.
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getDisplayDateKey } from "@/lib/date-utils";
import type { AssistantCommandCentre } from "@/lib/assistant/types";
import { TouchlinePageHeader, TouchlineButton } from "@/components/touchline";
import type { TodaySquadStatus } from "@/lib/touchline/presentation/today-view-model";
import type { CoachSituationProjection } from "@/lib/situational/situation-types";
import type { WeeklyCoachingContextResult } from "@/lib/weekly/weekly-coaching-context-types";
import type { MatchPresentation } from "@/lib/matches/match-presentation";
import { InstallPwaCard } from "@/components/pwa/install-prompt-card";
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

  const reviewCount = actionable.filter(
    (i) => i.category === "review_assigned" || i.category === "review_changes_requested",
  ).length;

  const hasContextRailContent = Boolean(
    (sinceLastVisitScope && sinceLastVisitFacts) ||
      squadStatus ||
      carryForwardItems.length > 0 ||
      (recentMatches && recentMatches.length > 0),
  );

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
            <TodayNextAction
              action={primaryAction}
              status={projection?.status}
              scope={sinceLastVisitScope ?? "default"}
              displayDateKey={getDisplayDateKey()}
              onApply={applyRecommendation}
              roundBoardBaseHref={orgUrl("/rounds")}
              orgUrl={orgUrl}
            />

            <TodaySelectionDecisions
              decisions={remainingSelectionDecisions}
              scope={sinceLastVisitScope ?? "default"}
              displayDateKey={getDisplayDateKey()}
              onApply={applyRecommendation}
              roundBoardBaseHref={orgUrl("/rounds")}
            />

            <TodayPlanningAttention signals={planningAttentionSignals} orgUrl={orgUrl} />

            <TodayOtherAttention items={otherAttentionItems} />

            <TodayOperationalTimeline
              matches={commandCentre.todayMatches}
              orgUrl={orgUrl}
              excludedMatchId={timelineExcludedMatchId}
            />

            <DueDecisionReviewSection reviews={commandCentre.dueDecisionReviews} />

            {reviewCount > 0 && (
              <div className="flex items-center justify-end">
                <TouchlineButton
                  as={Link}
                  href={orgUrl("/reviews")}
                  variant="ghost"
                  size="sm"
                  trailingIcon={<ArrowRight className="h-3 w-3" aria-hidden="true" />}
                >
                  View peer reviews
                </TouchlineButton>
              </div>
            )}

            <InstallPwaCard dismissible />
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
