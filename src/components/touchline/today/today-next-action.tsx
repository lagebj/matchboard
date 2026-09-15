"use client";

/**
 * Today "Next Action" hero (ADR-0141, ADR-0142 "Primary-action resolution correction"). Renders
 * whichever branch `resolveTodayPrimaryAction()` resolved — a Selection decision, a raw
 * plan-integrity signal, a live/imminent match, a generic situational decision, or (when there is
 * genuinely nothing) a featured upcoming match / quiet-day empty state. Never falls back to
 * unrelated assistant-item order.
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TouchlineButton } from "@/components/touchline";
import { NextMatchHero } from "@/components/touchline/widgets";
import { EmptyState } from "@/components/ui/empty-state";
import { todayMatchPresentation } from "@/lib/matches/today-match-presentation";
import type { TodayPrimaryAction } from "@/lib/touchline/presentation/today-primary-action";
import { TodayDecisionRow, type ApplyRecommendationFn } from "@/components/touchline/today/today-selection-decisions";
import type { CoachSituationProjectionStatus } from "@/lib/situational/situation-types";

function readyStateCopy(status: CoachSituationProjectionStatus | undefined): {
  title: string;
  description: string;
} {
  if (status === "LIVE") {
    return {
      title: "Nothing else needs attention while today's match is live.",
      description: "Follow along above, or open Fixtures to plan ahead.",
    };
  }
  return {
    title: "Nothing urgent right now.",
    description: "Upcoming rounds are under control. Open Fixtures to plan ahead.",
  };
}

export function TodayNextAction({
  action,
  status,
  scope,
  displayDateKey,
  onApply,
  roundBoardBaseHref,
  orgUrl,
  featuredMatch,
  featuredMatchHref,
}: {
  action: TodayPrimaryAction;
  status: CoachSituationProjectionStatus | undefined;
  scope: string;
  displayDateKey: string;
  onApply: ApplyRecommendationFn;
  roundBoardBaseHref: string;
  orgUrl: (path: string) => string;
  featuredMatch?: Parameters<typeof todayMatchPresentation>[0];
  featuredMatchHref?: string;
}) {
  if (action.kind === "SELECTION_DECISION") {
    return (
      <div className="flex flex-col gap-2 rounded-[var(--tl-c-radius-feature)] border border-[var(--border-strong)] bg-[var(--tl-c-surface-strong)] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">Next action</p>
        <ul className="flex flex-col">
          <TodayDecisionRow
            decision={action.decision}
            scope={scope}
            displayDateKey={displayDateKey}
            onApply={onApply}
            roundBoardBaseHref={roundBoardBaseHref}
            isPrimary
          />
        </ul>
      </div>
    );
  }

  if (action.kind === "PLAN_INTEGRITY_SIGNAL") {
    const signal = action.signal;
    return (
      <div className="flex flex-col gap-3 rounded-[var(--tl-c-radius-feature)] border border-[var(--border-strong)] bg-[var(--tl-c-surface-strong)] p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">Next action</p>
          <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            {signal.kind === "BLOCKED" ? "Blocked" : "Decision"}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-[20px] font-[620] leading-snug text-[var(--foreground)]">{signal.title}</h2>
          <p className="text-[13px] leading-snug text-[var(--text-soft)]">{signal.currentState}</p>
        </div>
        <div className="flex items-center justify-end">
          <TouchlineButton
            as={Link}
            href={orgUrl(signal.primaryActionTarget)}
            variant="primary"
            trailingIcon={<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            {signal.primaryActionLabel}
          </TouchlineButton>
        </div>
      </div>
    );
  }

  if (action.kind === "MATCH" || action.kind === "GENERIC") {
    const decision = action.decision;
    return (
      <div className="flex flex-col gap-3 rounded-[var(--tl-c-radius-feature)] border border-[var(--border-strong)] bg-[var(--tl-c-surface-strong)] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">Next action</p>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-[20px] font-[620] leading-snug text-[var(--foreground)]">{decision.title}</h2>
          {decision.summary && (
            <p className="text-[13px] leading-snug text-[var(--text-soft)]">{decision.summary}</p>
          )}
        </div>
        {(decision.recommendedAction || decision.deepLink) && (
          <div className="flex items-center justify-end">
            <TouchlineButton
              as={Link}
              href={decision.recommendedAction?.href ?? decision.deepLink!}
              variant="primary"
              trailingIcon={<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              {decision.recommendedAction?.label ?? "Open"}
            </TouchlineButton>
          </div>
        )}
      </div>
    );
  }

  // NONE — nothing forced to feature. A featured upcoming match becomes the hero instead of a
  // bare empty state when one exists; otherwise a genuinely quiet-day empty state.
  if (featuredMatch && featuredMatchHref) {
    return (
      <NextMatchHero
        presentation={todayMatchPresentation(featuredMatch, featuredMatchHref)}
        primaryAction={
          <TouchlineButton
            as={Link}
            href={featuredMatchHref}
            variant="primary"
            trailingIcon={<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            Match details
          </TouchlineButton>
        }
      />
    );
  }

  const readyState = readyStateCopy(status);
  return (
    <EmptyState
      tone="info"
      title={readyState.title}
      description={readyState.description}
      illustration="matchdayPrepSketch"
      action={
        <TouchlineButton
          as={Link}
          href={orgUrl("/fixtures")}
          variant="primary"
          trailingIcon={<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
        >
          Open Fixtures
        </TouchlineButton>
      }
    />
  );
}
