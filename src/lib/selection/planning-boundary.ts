import { db } from "@/lib/db";
import { ensureMatchPlanningBaselineCaptured } from "@/lib/selection/capture-planning-baseline";

export type PlanningBoundaryResult = {
  editable: boolean;
  reason?: string;
  warning?: string;
};

/**
 * The real-world facts a pre-match planning boundary is derived from. Shared by the League
 * `Match` adapter (`isMatchPlanningEditable`) and the Event `EventMatch` adapter
 * (`isEventMatchLineupEditable`, `src/lib/events/event-planning-boundary.ts`) so both containers
 * reason from ONE definition (ARR-0038 / Consolidation Programme C2). Intentional differences
 * stay in the adapters, not here:
 *  - League passes its persisted `planningClosedAt` marker (the historical baseline was frozen);
 *    Event has nothing to freeze (no Selection/MovementLedger/round), so it always passes `null`.
 *  - Event passes `reportStatus` (a completed/started Event report closes lineup editing); League
 *    omits it because a League report only ever exists after the boundary already closed.
 */
export type PlanningBoundaryFacts = {
  /** `Match.status` / `EventMatch.status` — only `"CANCELLED"` is significant here. */
  matchStatus: string;
  startsAt: Date | string | null;
  /** League's persisted close marker; `null`/omitted for Event. */
  planningClosedAt?: Date | string | null;
  /** Linked live-session status — `"ACTIVE"` closes the boundary. */
  liveSessionStatus?: string | null;
  /** Event only: a `"DRAFT"` / `"REPORTED"` / `"LOCKED"` post-match report closes lineup editing. */
  reportStatus?: "NONE" | "DRAFT" | "REPORTED" | "LOCKED" | null;
  now?: Date;
};

/**
 * Pure boundary decision — no DB, no side effects. Callers that own a real record layer the
 * lazy baseline capture around this (see `isMatchPlanningEditable`).
 */
export function isPlanningBoundaryClosed(facts: PlanningBoundaryFacts): PlanningBoundaryResult {
  const now = facts.now ?? new Date();

  if (facts.matchStatus === "CANCELLED") {
    return { editable: false, reason: "Cannot edit planning for a cancelled match." };
  }
  if (facts.planningClosedAt) {
    return { editable: false, reason: "Planning is closed for this match." };
  }
  if (facts.liveSessionStatus === "ACTIVE") {
    return { editable: false, reason: "Cannot edit planning for a match that has started live reporting." };
  }
  if (facts.reportStatus && facts.reportStatus !== "NONE") {
    return { editable: false, reason: "Planning is closed — a post-match report exists for this match." };
  }
  if (facts.startsAt && new Date(facts.startsAt) <= now) {
    return { editable: false, reason: "Scheduled kickoff has passed. Planning is closed for this match." };
  }
  return { editable: true };
}

/**
 * The single mutability gate for pre-match plan mutation on a League `Match` (ADR-0109).
 * Round-level `FINALIZED` status is deliberately NOT consulted here — it is a downstream side
 * effect of every constituent match's own boundary closing (Migration Rule #8: a persisted round
 * status must not be the canonical gate). Kickoff passing is a real closing condition, not a
 * warning: this function performs the boundary capture itself, lazily and idempotently, the
 * first time it observes the boundary has closed (Migration Rule #5/#6; PRINCIPLES.md #16).
 */
export async function isMatchPlanningEditable(matchId: string, options?: { now?: Date }): Promise<PlanningBoundaryResult> {
  const now = options?.now ?? new Date();
  const match = await db.match.findFirst({
    where: { id: matchId },
    select: {
      id: true,
      organisationId: true,
      startsAt: true,
      status: true,
      planningClosedAt: true,
      liveSession: { select: { id: true, status: true, startedAt: true } },
    },
  });

  if (!match) {
    return { editable: false, reason: "Match not found." };
  }

  const result = isPlanningBoundaryClosed({
    matchStatus: match.status,
    startsAt: match.startsAt,
    planningClosedAt: match.planningClosedAt,
    liveSessionStatus: match.liveSession?.status ?? null,
    now,
  });

  // Kickoff passing / live start is a real closing condition — capture the historical baseline
  // lazily and idempotently the first time we observe it (only when not already captured).
  if (
    !result.editable &&
    !match.planningClosedAt &&
    match.status !== "CANCELLED" &&
    (match.liveSession?.status === "ACTIVE" || (match.startsAt && new Date(match.startsAt) <= now))
  ) {
    await ensureMatchPlanningBaselineCaptured(matchId, { now });
  }

  return result;
}

/**
 * Round-level editability requires every active match in the round to still be open. If any
 * match's boundary has closed, this also triggers that match's lazy baseline capture as a side
 * effect (same rationale as `isMatchPlanningEditable`).
 */
export async function isMatchRoundPlanningEditable(matchRoundId: string, options?: { now?: Date }): Promise<PlanningBoundaryResult> {
  const now = options?.now ?? new Date();
  const matchRound = await db.matchRound.findFirst({
    where: { id: matchRoundId },
    select: { id: true },
  });

  if (!matchRound) {
    return { editable: false, reason: "Match round not found." };
  }

  const matches = await db.match.findMany({
    where: { matchRoundId, status: { not: "CANCELLED" } },
    select: {
      id: true,
      startsAt: true,
      planningClosedAt: true,
      liveSession: { select: { id: true, status: true, startedAt: true } },
    },
  });

  let closedReason: string | null = null;

  for (const match of matches) {
    if (match.planningClosedAt) {
      closedReason = "Planning is closed for one or more matches in this round.";
      continue;
    }
    if (match.liveSession?.status === "ACTIVE") {
      await ensureMatchPlanningBaselineCaptured(match.id, { now });
      closedReason = "Live reporting has started for one or more matches in this round.";
      continue;
    }
    if (match.startsAt && new Date(match.startsAt) <= now) {
      await ensureMatchPlanningBaselineCaptured(match.id, { now });
      closedReason = "Scheduled kickoff has passed for one or more matches in this round.";
    }
  }

  if (closedReason) {
    return { editable: false, reason: closedReason };
  }

  return { editable: true };
}

function toDate(value: Date | string | null): Date | null {
  if (value == null) return null;
  return value instanceof Date ? value : new Date(value);
}

export type MatchLifecycleStatus =
  | "planning_open"
  | "planning_closed"
  | "live"
  | "played"
  | "report_incomplete"
  | "done"
  | "cancelled";

export type ReportStatusForLifecycle = "NONE" | "DRAFT" | "REPORTED" | "LOCKED";

/**
 * The primary, football-action-oriented match status (DECISIONS.md "User-facing lifecycle
 * vocabulary": "Planning open, Upcoming, Live, Played, Report incomplete, Done"). Supersedes
 * Draft/Blocked/Ready/Finalized as the PRIMARY label wherever a single match's status is shown —
 * see ADR-0101. That vocabulary is not removed: it remains the correct internal signal for
 * selection-planning completeness (plan integrity, override requirements) and is still surfaced
 * within `planning_open`/`planning_closed` when relevant (e.g. "Planning open — 2 decisions
 * needed"). It must never again be shown as if it described whether a match has been played.
 *
 * Report status is checked first and wins over everything else — once a report exists, that is
 * the most true statement about where the match stands, regardless of whether the round was
 * ever technically "finalized" (finalizing the plan and completing the report are different
 * facts; a round can be finalized long before its match is played — see AGENTS.md "Fixtures
 * result display rules": "Finalized does not mean the match has been played or reported").
 */
export function deriveMatchLifecycleStatus(params: {
  matchStatus: string;
  reportStatus: ReportStatusForLifecycle;
  hasPassed: boolean;
  isLive: boolean;
  roundStatus: string;
  planningClosedAt: Date | string | null;
  startsAt: Date | string | null;
  now?: Date;
}): MatchLifecycleStatus {
  const { matchStatus, reportStatus, hasPassed, isLive, roundStatus, planningClosedAt, startsAt } = params;
  const now = params.now ?? new Date();

  if (matchStatus === "CANCELLED") return "cancelled";
  if (reportStatus === "LOCKED") return "done";
  if (reportStatus === "DRAFT" || reportStatus === "REPORTED") return "report_incomplete";
  if (isLive) return "live";
  if (hasPassed) return "played";

  if (roundStatus === "FINALIZED") return "planning_closed";
  const closedAt = toDate(planningClosedAt);
  if (closedAt) return "planning_closed";
  const kickoff = toDate(startsAt);
  if (kickoff && kickoff <= now) return "planning_closed";

  return "planning_open";
}