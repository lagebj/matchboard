"use client";

/**
 * Today "Selection decisions" section (ADR-0141, ADR-0142
 * `03_DECISION_PRESENTATION_AND_LOGIC_FIXES.md`). Renders one concrete plan-integrity decision
 * per affected player with a three-zone anatomy — PLAYER/PROBLEM | WHY | ACTION — never rendering
 * invented certainty: `directlyActionable` and `dependsOnPrior` come straight from the pure
 * planner, never guessed client-side. Dismissal keys against `decisionFingerprint` (a hash of the
 * decision's current material state), not the stable `signalKey`, so a materially changed
 * decision reappears automatically instead of staying hidden behind a stale dismissal.
 */

import { useState, useTransition, useEffect as useEffectOnMount } from "react";
import Link from "next/link";
import { ArrowRight, Check, UserPlus } from "lucide-react";
import { Surface } from "@/components/ui/surface";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import { TouchlineButton } from "@/components/touchline";
import type { TodaySelectionDecision } from "@/lib/touchline/presentation/today-selection-recommendation-plan";
import {
  emptyTodayDismissedState,
  pruneStaleDismissals,
  isDismissed,
  withDismissal,
  withoutDismissal,
  type TodayDismissedStateV1,
} from "@/lib/touchline/presentation/today-dismiss-state";

export type ApplyRecommendationFn = (input: {
  playerId: string;
  targetMatchId: string;
  role: "CORE" | "SUPPORT" | "DEVELOPMENT";
  recommendationFingerprint: string;
}) => Promise<{ success: boolean; message: string }>;

function readDismissedState(storageKey: string, displayDateKey: string): TodayDismissedStateV1 {
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? (JSON.parse(raw) as TodayDismissedStateV1) : null;
    return pruneStaleDismissals(parsed, displayDateKey);
  } catch {
    // localStorage errors fail open — the page keeps working and the row remains visible.
    return emptyTodayDismissedState();
  }
}

function writeDismissedState(storageKey: string, state: TodayDismissedStateV1) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Fail open — dismissal simply won't persist across a reload.
  }
}

/** WHY-zone heading. `RECOMMENDED BECAUSE` only when Matchboard has a real safe one-click
 * recommendation; `COORDINATED PLAN` for a dependent row; `CURRENT SITUATION` for review-only —
 * never fake "recommendation" language when there is no safe direct action (ADR-0142). */
function whyHeading(decision: TodaySelectionDecision): string {
  const rec = decision.recommendation;
  if (rec?.directlyActionable) return "RECOMMENDED BECAUSE";
  if (rec?.dependsOnPrior) return "COORDINATED PLAN";
  return "CURRENT SITUATION";
}

function primaryActionLabel(decision: TodaySelectionDecision, compact: boolean): string | null {
  const rec = decision.recommendation;
  if (!rec?.directlyActionable) return null;
  return compact
    ? `Add to ${rec.targetTeamName} vs ${rec.opponentName}`
    : `Add ${decision.displayName} to ${rec.targetTeamName} vs ${rec.opponentName}`;
}

export function TodayDecisionRow({
  decision,
  scope,
  displayDateKey,
  onApply,
  roundBoardBaseHref,
  /** True when this decision is currently promoted into the page's primary Next Action slot —
   * hides "Dismiss today" while primary (ADR-0142 "Primary-action dismissal"). */
  isPrimary = false,
}: {
  decision: TodaySelectionDecision;
  scope: string;
  displayDateKey: string;
  onApply: ApplyRecommendationFn;
  roundBoardBaseHref: string;
  isPrimary?: boolean;
}) {
  const storageKey = `matchboard:today:dismissed:v1:${scope}`;
  const [dismissed, setDismissed] = useState(false);
  const [applied, setApplied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const rec = decision.recommendation;
  const fingerprint = decision.decisionFingerprint;

  // Read the persisted dismissal after mount only — the server render has no localStorage, and
  // checking here (rather than in a lazy `useState` initializer) avoids a hydration mismatch.
  useEffectOnMount(() => {
    const state = readDismissedState(storageKey, displayDateKey);
    if (isDismissed(state, fingerprint, displayDateKey)) setDismissed(true);
    // Intentionally runs once on mount only — reading the persisted dismissal state at any other
    // time would re-trigger on every prop change.
  }, []);

  function dismiss() {
    const state = readDismissedState(storageKey, displayDateKey);
    writeDismissedState(storageKey, withDismissal(state, fingerprint, displayDateKey));
    setDismissed(true);
  }

  function restore() {
    const state = readDismissedState(storageKey, displayDateKey);
    writeDismissedState(storageKey, withoutDismissal(state, fingerprint));
    setDismissed(false);
  }

  function apply() {
    if (!rec || !rec.directlyActionable) return;
    startTransition(async () => {
      const result = await onApply({
        playerId: decision.playerId,
        targetMatchId: rec.targetMatchId,
        role: rec.role,
        recommendationFingerprint: rec.fingerprint,
      });
      setMessage(result.message);
      if (result.success) setApplied(true);
    });
  }

  if (dismissed) {
    return (
      <li className="flex items-center justify-between gap-3 border-b border-[var(--border-soft)] py-2 text-xs text-[var(--text-muted)] last:border-b-0">
        <span>{decision.displayName} — dismissed today.</span>
        <button type="button" onClick={restore} className="underline underline-offset-2 hover:text-[var(--foreground)]">
          Restore
        </button>
      </li>
    );
  }

  const actionLabelExpanded = primaryActionLabel(decision, false);
  const actionLabelCompact = primaryActionLabel(decision, true);

  return (
    <li className="grid grid-cols-1 gap-3 border-b border-[var(--border-soft)] py-3 last:border-b-0 expanded:grid-cols-[minmax(0,4fr)_minmax(0,5fr)_minmax(0,4fr)] expanded:items-start">
      {/* PLAYER / PROBLEM zone */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-[var(--foreground)] truncate">{decision.displayName}</p>
          <StatusPill variant={decision.availability === "AVAILABLE" ? "success" : "neutral"} size="sm">
            {decision.availability === "AVAILABLE" ? "Available" : decision.availability === "TENTATIVE" ? "Tentative" : "Unavailable"}
          </StatusPill>
        </div>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">{decision.problemDetail}</p>
      </div>

      {/* WHY zone */}
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          {whyHeading(decision)}
        </p>
        {decision.reasons.length > 0 && (
          <ul className="mt-1 flex flex-col gap-0.5">
            {decision.reasons.map((r, i) => (
              <li key={i} className="text-xs text-[var(--text-soft)]">
                {r.text}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ACTION zone */}
      <div className="flex flex-col items-start gap-2 expanded:items-end">
        {applied ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-strong)]">
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            {message ?? "Added."}
          </span>
        ) : actionLabelExpanded ? (
          <TouchlineButton
            variant="primary"
            size="sm"
            onClick={apply}
            disabled={isPending}
            leadingIcon={<UserPlus className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            <span className="expanded:hidden">{actionLabelCompact}</span>
            <span className="hidden expanded:inline">{actionLabelExpanded}</span>
          </TouchlineButton>
        ) : rec?.dependsOnPrior ? (
          <span className="text-xs text-[var(--text-muted)]">Resolve earlier decision first.</span>
        ) : (
          <span className="text-xs text-[var(--text-muted)]">{rec?.unavailableReason ?? "Review on the Round Board."}</span>
        )}

        <TouchlineButton
          as={Link}
          href={decision.roundBoardHref || roundBoardBaseHref}
          variant="ghost"
          size="sm"
          trailingIcon={<ArrowRight className="h-3 w-3" aria-hidden="true" />}
        >
          Review in Round Board
        </TouchlineButton>

        {!applied && !isPrimary && (
          <button
            type="button"
            onClick={dismiss}
            className="text-xs text-[var(--text-muted)] underline underline-offset-2 hover:text-[var(--foreground)]"
          >
            Dismiss today
          </button>
        )}

        {message && !applied && <span className="text-xs text-[var(--danger)]">{message}</span>}
      </div>
    </li>
  );
}

export function TodaySelectionDecisions({
  decisions,
  scope,
  displayDateKey,
  onApply,
  roundBoardBaseHref,
}: {
  decisions: TodaySelectionDecision[];
  scope: string;
  displayDateKey: string;
  onApply: ApplyRecommendationFn;
  roundBoardBaseHref: string;
}) {
  if (decisions.length === 0) return null;

  return (
    <Surface padding="md" className="flex flex-col gap-3">
      <SectionHeader
        title="Selection decisions"
        description="Available players without a planned opportunity this round — with a safe next step."
        eyebrow={`${decisions.length} decision${decisions.length === 1 ? "" : "s"}`}
      />
      <ul className="flex flex-col">
        {decisions.map((decision) => (
          <TodayDecisionRow
            key={decision.signalKey}
            decision={decision}
            scope={scope}
            displayDateKey={displayDateKey}
            onApply={onApply}
            roundBoardBaseHref={roundBoardBaseHref}
          />
        ))}
      </ul>
    </Surface>
  );
}
