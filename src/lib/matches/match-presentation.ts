/**
 * Match Presentation System — the one normalized display projection for a match
 * (ADR-0125, `.matchboard-work/matchboard-reference-convergence-programme/03_NBA_MATCH_SPEC.md`).
 *
 * Canonical match data is normalized into display fields *once*, here, so every
 * match surface (Today, League/Fixtures, Events, match headers, Follow Live,
 * history, player participation) renders from the same contract via one of the
 * four canonical variants — `MatchRow`, `MatchCard`, `MatchHeader`, `MatchLiveStrip`.
 *
 * This changes no domain truth. Lifecycle is still `deriveMatchLifecycleStatus()`;
 * scores are still whatever canonical post-match/live data produced. The builder
 * only re-orients our-team-relative facts into football home/away order and
 * collapses the various caller shapes into one projection.
 */
import type { MatchLifecycleStatus } from "@/lib/selection/planning-boundary";
import { formatMatchDateShort, formatKickoffTime } from "@/lib/date-utils";

export type MatchPresentationOutcome = "win" | "loss" | "draw" | "unknown";

/** A single quiet condition attached to a match — attaching the count to the
 * object it belongs to is required by the Today/League composition rules. */
export type MatchPresentationAttention = {
  label: string;
  tone: "danger" | "warning" | "muted";
};

export type MatchPresentation = {
  id: string;
  href: string | null;
  /** Football order: home first. */
  homeTeam: string;
  awayTeam: string;
  /** Which side is the Matchboard org's own team, for the subtle own-team marker. */
  ownTeamSide: "home" | "away" | null;
  kickoffDate: string | null;
  kickoffTime: string | null;
  lifecycle: MatchLifecycleStatus;
  /**
   * Home/away oriented. `null` until a canonical score exists. Can be non-null on an
   * `awaiting_report` phase presentation (`matchPresentationPhase()`) — e.g. a report a coach is
   * actively editing, or a DRAFT/REPORTED-but-not-locked report's recorded goals. A renderer may
   * show that number transparently; it must never label it "FT" or pair it with a Win/Draw/Loss
   * claim (`outcomeLabel`/`resultOutcomeForOwnTeam` stay gated to `phase === "final"` throughout
   * this codebase) — that pairing, not the bare number, is what makes a result read as confirmed
   * (issue #853).
   */
  score: { home: number; away: number } | null;
  /** e.g. "37′" for a live match. */
  clockLabel: string | null;
  /** W/D/L from the own team's perspective, plus a short label ("WON"). */
  resultOutcomeForOwnTeam: MatchPresentationOutcome;
  outcomeLabel: string | null;
  planningAttention: MatchPresentationAttention | null;
  reportAttention: MatchPresentationAttention | null;
  cancelledReason: string | null;
};

type BuildInput = {
  id: string;
  href?: string | null;
  /** The Matchboard org's own team. */
  teamName: string;
  opponentName?: string | null;
  /** True when the own team plays at home. Default true. */
  isHome?: boolean;
  /** Whether to mark the own team subtly. Default true. */
  markOwnTeam?: boolean;
  kickoffAt?: Date | string | null;
  lifecycleStatus: MatchLifecycleStatus;
  /** Own-team goals (our-team-relative). Re-oriented to home/away here. */
  ownGoals?: number | null;
  opponentGoals?: number | null;
  liveClockLabel?: string | null;
  /** Canonical completed outcome for the own team. */
  outcome?: "WON" | "DRAWN" | "LOST" | null;
  planningAttention?: MatchPresentationAttention | null;
  reportAttention?: MatchPresentationAttention | null;
  cancelledReason?: string | null;
};

function outcomeFor(outcome: BuildInput["outcome"]): MatchPresentationOutcome {
  if (outcome === "WON") return "win";
  if (outcome === "LOST") return "loss";
  if (outcome === "DRAWN") return "draw";
  return "unknown";
}

export function buildMatchPresentation(input: BuildInput): MatchPresentation {
  const isHome = input.isHome ?? true;
  const opponent = input.opponentName ?? "Opponent";
  const kickoff =
    input.kickoffAt == null
      ? null
      : input.kickoffAt instanceof Date
        ? input.kickoffAt
        : new Date(input.kickoffAt);

  const hasScore =
    input.lifecycleStatus !== "cancelled" &&
    input.ownGoals != null &&
    input.opponentGoals != null;

  const score = hasScore
    ? isHome
      ? { home: input.ownGoals as number, away: input.opponentGoals as number }
      : { home: input.opponentGoals as number, away: input.ownGoals as number }
    : null;

  return {
    id: input.id,
    href: input.href ?? null,
    homeTeam: isHome ? input.teamName : opponent,
    awayTeam: isHome ? opponent : input.teamName,
    ownTeamSide: input.markOwnTeam === false ? null : isHome ? "home" : "away",
    kickoffDate: kickoff ? formatMatchDateShort(kickoff) : null,
    kickoffTime: kickoff ? formatKickoffTime(kickoff) : null,
    lifecycle: input.lifecycleStatus,
    score,
    clockLabel: input.liveClockLabel ?? null,
    resultOutcomeForOwnTeam:
      input.lifecycleStatus === "cancelled" ? "unknown" : outcomeFor(input.outcome),
    outcomeLabel:
      input.lifecycleStatus === "cancelled" || !input.outcome
        ? null
        : input.outcome === "WON"
          ? "WON"
          : input.outcome === "LOST"
            ? "LOST"
            : "DRAW",
    planningAttention: input.planningAttention ?? null,
    reportAttention: input.reportAttention ?? null,
    cancelledReason: input.cancelledReason ?? null,
  };
}

/**
 * The phase grammar a variant renders. Derived from `lifecycle` ALONE (issue #853) — a non-null
 * `score` must never, by itself, promote a match to `final`. `played` (kickoff passed, no report
 * at all) and `report_incomplete` (a DRAFT or not-yet-locked report) share `awaiting_report`:
 * kickoff has happened but completion is not confirmed, so no variant may render an unqualified
 * "FT" for either. Only `done` (a locked, canonical result) is `final`.
 */
export type MatchPresentationPhase = "scheduled" | "live" | "awaiting_report" | "final" | "cancelled";

export function matchPresentationPhase(p: MatchPresentation): MatchPresentationPhase {
  if (p.lifecycle === "cancelled") return "cancelled";
  if (p.lifecycle === "live") return "live";
  if (p.lifecycle === "done") return "final";
  if (p.lifecycle === "played" || p.lifecycle === "report_incomplete") return "awaiting_report";
  return "scheduled";
}

/**
 * A short, always-truthful trailing label for an `awaiting_report` phase — safe to show alone at
 * any width, never a bare "FT". Prefers a caller-supplied report-state qualifier (`reportAttention`,
 * e.g. "Report missing"/"Report draft") when one is available; otherwise falls back to the exact
 * same "Played" / "Report incomplete" words `lifecycleStatusConfigFor()`
 * (`src/components/ui/status-badge.tsx`) already uses for the lifecycle badge (ADR-0101 /
 * DECISIONS.md "User-facing lifecycle vocabulary") — never a new, uncoordinated term.
 */
export function awaitingReportLabel(p: MatchPresentation): string {
  if (p.reportAttention) return p.reportAttention.label;
  return p.lifecycle === "played" ? "Played" : "Report incomplete";
}

/** Attention precedence for a scan-density row (07 §5): lifecycle truth is carried
 * by the badge; this picks the single secondary attention line. */
export function primaryAttention(p: MatchPresentation): MatchPresentationAttention | null {
  return p.planningAttention ?? p.reportAttention ?? null;
}
