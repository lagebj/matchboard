/**
 * Today composition selection (ADR-0157 §6, `04_TODAY_SURFACE.md`). Pure, no I/O. Decides which
 * of the two accepted compositions (quiet day / decision day) Today renders, and builds the
 * bounded "Why?" disclosure content and "This week" chronology from data the caller already
 * loaded. Never re-ranks anything the situational projection or `resolveTodayPrimaryAction()`
 * already decided — this module only reads their output.
 */

import type { TodayPrimaryAction } from "@/lib/touchline/presentation/today-primary-action";
import type { DueDecisionReviewCard } from "@/lib/assistant/types";
import type { MatchPresentation } from "@/lib/matches/match-presentation";

export type TodayCompositionState = "QUIET" | "DECISION";

/**
 * `resolveTodayPrimaryAction()` already returns `{ kind: "NONE" }` exactly when there is no
 * live/imminent match, no plan-integrity signal, and no situational decision at all — i.e.
 * most of the quiet-day trigger `04_TODAY_SURFACE.md` describes. Reusing that existing result
 * instead of re-deriving the same condition is the whole point of this function: one quiet/
 * decision switch, backed by the one already-computed primary-action resolution, never a second
 * relevance system.
 *
 * The one additional trigger condition the bundle names that `resolveTodayPrimaryAction()` does
 * not itself cover is "no due peer/development review that the situation policy promotes" — due
 * reviews (`DueDecisionReviewCard`) are not currently fed into the situational projection as
 * candidates at all, so there is no projection decision to check. Until that wiring exists, a
 * non-empty due-review list is treated as forcing `"DECISION"` directly — a disclosed, narrow
 * adaptation of the same rule, not a second priority system (it adds no ranking, only a single
 * boolean gate alongside the existing one).
 */
export function selectTodayComposition(primaryAction: TodayPrimaryAction, hasDueReview: boolean): TodayCompositionState {
  if (hasDueReview) return "DECISION";
  return primaryAction.kind === "NONE" ? "QUIET" : "DECISION";
}

export type TodayDecisionWhyContent = {
  /** What changed or what problem is being resolved. */
  problem: string;
  /** Why this option is valid — deterministic reasons only, never AI prose. */
  why: string[];
  /** What consequence the option addresses, when known. */
  consequence: string | null;
  /** Evidence/sample caveats, when supplied (ADR-0157 §4 `evidenceSupport`). */
  caveats: string[];
};

/** §03 "Why?" required order: problem, why-valid, consequence, caveats, (alternatives are
 * rendered by the existing selection-decision row itself when interaction is CHOOSE). A known,
 * closed, bounded set of Rego `situation` reason codes (`matchboard_situation.rego`'s own
 * `reason_code_set` rules) — never arbitrary text. */
const REASON_CODE_LABELS: Record<string, string> = {
  MATCH_LIVE: "This match is currently live.",
  MATCH_IMMINENT: "Kickoff is imminent.",
  HARD_CONSEQUENCE: "Leaving this unresolved could affect whether the match is playable or the squad is complete.",
  LONG_TERM_SIGNAL_SUPPRESSED_ON_MATCHDAY: "Longer-term signals stay hidden while a match is live or imminent.",
  LONG_TERM_SIGNAL_DEFERRED: "This can wait until closer to the next match.",
  LONG_TERM_SIGNAL_AFFECTS_NEXT_ROUND: "This affects a choice for the next round.",
  LONG_TERM_REVIEW_CONTENT: "This needs a fuller review rather than a one-click action.",
  REPORTING_DEBT_DEFERRED: "Reporting catch-up is deferred until after the live match.",
  REPORTING_DEBT_VISIBLE: "A completed match still needs its report.",
  RECOMMENDATION_AVAILABLE: "Matchboard has a direct recommendation for this.",
  MULTIPLE_ALTERNATIVES: "There is more than one valid option here.",
  REQUIRES_REVIEW: "This needs review in its own workspace rather than a single action.",
};

export function humanizeReasonCodes(codes: readonly string[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const code of codes) {
    const label = REASON_CODE_LABELS[code] ?? code;
    if (seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  return labels;
}

/**
 * Builds the Why? disclosure content for the primary action, when one exists beyond what is
 * already shown inline. A `SELECTION_DECISION` already renders its own reasons inline in
 * `TodayDecisionRow`'s WHY zone (ADR-0142) -- duplicating that here would be a second,
 * competing disclosure for the same decision, so this returns `null` for that branch
 * deliberately, not as an oversight.
 */
export function buildTodayDecisionWhyContent(action: TodayPrimaryAction): TodayDecisionWhyContent | null {
  if (action.kind === "PLAN_INTEGRITY_SIGNAL") {
    const signal = action.signal;
    return {
      problem: signal.currentState,
      why: signal.classificationReason ? [signal.classificationReason] : [],
      consequence: signal.consequence || null,
      caveats: [],
    };
  }

  if (action.kind === "MATCH" || action.kind === "GENERIC") {
    const decision = action.decision;
    return {
      problem: decision.summary ?? decision.title,
      why: humanizeReasonCodes(decision.reasonCodes),
      consequence: null,
      caveats: decision.evidenceSupport?.caveats ?? [],
    };
  }

  return null;
}

export type TodayWeekChronologyItem = {
  key: string;
  label: string;
  meta: string;
  href: string;
};

const MAX_WEEK_CHRONOLOGY_ITEMS = 4;

/**
 * Quiet-day "This week" compact chronology (§04 composition state A item 4): up to four
 * football/review items, merged from already-loaded due-decision reviews and the bounded
 * upcoming-match loader, in chronological order. Never a generic feed of every unresolved
 * historical item.
 */
export function selectTodayWeekChronologyItems(params: {
  upcomingMatches: MatchPresentation[];
  dueDecisionReviews: DueDecisionReviewCard[];
  limit?: number;
}): TodayWeekChronologyItem[] {
  const limit = params.limit ?? MAX_WEEK_CHRONOLOGY_ITEMS;

  const matchItems = params.upcomingMatches.map((m) => ({
    key: `match:${m.id}`,
    label: `${m.homeTeam} vs ${m.awayTeam}`,
    meta: [m.kickoffDate, m.kickoffTime].filter(Boolean).join(" · "),
    href: m.href ?? "",
    sortAt: `${m.kickoffDate ?? ""}T${m.kickoffTime ?? "00:00"}`,
  }));

  const reviewItems = params.dueDecisionReviews.map((r) => ({
    key: `review:${r.reviewId}`,
    label: `${r.label} — ${r.targetName}`,
    meta: "Ready to revisit",
    href: r.targetHref,
    sortAt: r.dueAt,
  }));

  return [...matchItems, ...reviewItems]
    .sort((a, b) => a.sortAt.localeCompare(b.sortAt))
    .slice(0, limit)
    .map(({ key, label, meta, href }) => ({ key, label, meta, href }));
}
