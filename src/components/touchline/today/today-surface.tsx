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
import { resolveFeaturedUpcomingMatch } from "@/lib/matches/today-match-presentation";
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
import type { TodaySelectionDecision } from "@/lib/touchline/presentation/today-selection-recommendation-plan";
import type { TodayLiveNowResult } from "@/lib/live-match/get-today-live-match-summaries";
import type { TodayVisitCurrentFacts } from "@/lib/touchline/presentation/today-visit-snapshot";
import type { TodayCarryForwardItem } from "@/lib/touchline/presentation/today-carry-forward";

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
}) {
  const orgUrl = useOrgUrl();
  const { items, leagueSeasonName } = commandCentre;
  const actionable = items.filter(isActionable);

  const primaryAction = resolveTodayPrimaryAction({
    projectionDecisions: projection?.decisions ?? [],
    selectionDecisions,
    roundPlanIntegrities: commandCentre.roundPlanIntegrities,
    todayMatches: commandCentre.todayMatches,
  });

  const featuredMatch =
    primaryAction.kind === "NONE" ? resolveFeaturedUpcomingMatch(commandCentre.todayMatches) : undefined;
  const featuredMatchHref = featuredMatch
    ? featuredMatch.squadStatus === "not_generated"
      ? orgUrl("/fixtures")
      : orgUrl(`/matches/${featuredMatch.matchId}`)
    : undefined;

  // Exclude whichever signal/decision was promoted to the primary action from the lower
  // full-detail sections, to avoid duplication (ADR-0142 "Primary-action resolution correction").
  const promotedSelectionSignalKey = primaryAction.kind === "SELECTION_DECISION" ? primaryAction.decision.signalKey : null;
  const promotedPlanIntegrityKey = primaryAction.kind === "PLAN_INTEGRITY_SIGNAL" ? primaryAction.signal.idempotencyKey : null;
  const promotedWorkItemId =
    primaryAction.kind === "GENERIC" ? workItemIdFromCandidateId(primaryAction.decision.candidateId) : null;

  const remainingSelectionDecisions = selectionDecisions.filter((d) => d.signalKey !== promotedSelectionSignalKey);
  const excludedFromPlanningAttention = new Set<string>(promotedPlanIntegrityKey ? [promotedPlanIntegrityKey] : []);
  const planningAttentionSignals = selectTodayPlanningAttentionSignals(
    commandCentre.roundPlanIntegrities,
    excludedFromPlanningAttention,
  );

  const otherAttentionExcludeIds = new Set<string>(promotedWorkItemId ? [promotedWorkItemId] : []);
  const otherAttentionItems = selectTodayOtherAttentionItems(actionable, otherAttentionExcludeIds);

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
    <div className="touchline relative flex flex-col gap-6">
      <TodayAtmosphere />
      <div className="relative z-10 flex flex-col gap-6">
        <TouchlinePageHeader
          title="Today"
          context={leagueSeasonName ?? "What needs attention before the next matches."}
        />

        {liveNow && (
          <TodayLiveNow
            primary={liveNow.primary}
            otherLiveCount={liveNow.otherLiveCount}
            matchHref={(matchId) => orgUrl(`/matches/${matchId}/live`)}
          />
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
              featuredMatch={featuredMatch}
              featuredMatchHref={featuredMatchHref}
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

            <TodayOperationalTimeline matches={commandCentre.todayMatches} orgUrl={orgUrl} />

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
