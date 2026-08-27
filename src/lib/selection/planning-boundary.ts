import { db } from "@/lib/db";

export type PlanningBoundaryResult = {
  editable: boolean;
  reason?: string;
  warning?: string;
};

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
      matchRound: { select: { id: true, status: true } },
      liveSession: { select: { id: true, status: true, startedAt: true } },
    },
  });

  if (!match) {
    return { editable: false, reason: "Match not found." };
  }

  if (match.status === "CANCELLED") {
    return { editable: false, reason: "Cannot edit planning for a cancelled match." };
  }

  if (match.matchRound.status === "FINALIZED") {
    return { editable: false, reason: "Cannot edit a match in a finalised round." };
  }

  if (match.planningClosedAt) {
    return { editable: false, reason: "Planning is closed for this match." };
  }

  if (match.liveSession?.status === "ACTIVE") {
    return { editable: false, reason: "Cannot edit planning for a match that has started live reporting." };
  }

  if (match.startsAt && new Date(match.startsAt) <= now) {
    return { editable: true, warning: "Scheduled kickoff has passed. Editing is still possible but a confirmation will be required." };
  }

  return { editable: true };
}

export async function isMatchRoundPlanningEditable(matchRoundId: string, options?: { now?: Date }): Promise<PlanningBoundaryResult> {
  const now = options?.now ?? new Date();
  const matchRound = await db.matchRound.findFirst({
    where: { id: matchRoundId },
    select: { id: true, status: true },
  });

  if (!matchRound) {
    return { editable: false, reason: "Match round not found." };
  }

  if (matchRound.status === "FINALIZED") {
    return { editable: false, reason: "Cannot edit a finalised round." };
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

  for (const match of matches) {
    if (match.planningClosedAt) {
      return { editable: false, reason: "Planning is closed for one or more matches in this round." };
    }
    if (match.liveSession?.status === "ACTIVE") {
      return { editable: false, reason: "Live reporting has started for one or more matches in this round." };
    }
  }

  const pastKickoff = matches.some(
    (m) => m.startsAt && new Date(m.startsAt) <= now,
  );

  if (pastKickoff) {
    return { editable: true, warning: "Scheduled kickoff has passed for one or more matches. Editing is still possible but a confirmation will be required." };
  }

  return { editable: true };
}

export async function closeMatchPlanning(matchId: string): Promise<{ closed: boolean; reason?: string }> {
  const match = await db.match.findFirst({
    where: { id: matchId },
    select: { id: true, planningClosedAt: true, status: true },
  });

  if (!match) {
    return { closed: false, reason: "Match not found." };
  }

  if (match.status === "CANCELLED") {
    return { closed: false, reason: "Cannot close planning for a cancelled match." };
  }

  if (match.planningClosedAt) {
    return { closed: true };
  }

  await db.match.update({
    where: { id: matchId },
    data: { planningClosedAt: new Date() },
  });

  return { closed: true };
}

export async function closeMatchRoundPlanning(matchRoundId: string): Promise<{ closed: boolean; reasons: string[] }> {
  const matches = await db.match.findMany({
    where: { matchRoundId, status: { not: "CANCELLED" }, planningClosedAt: null },
    select: { id: true },
  });

  const reasons: string[] = [];

  for (const match of matches) {
    const result = await closeMatchPlanning(match.id);
    if (!result.closed && result.reason) {
      reasons.push(result.reason);
    }
  }

  return { closed: reasons.length === 0, reasons };
}

function toDate(value: Date | string | null): Date | null {
  if (value == null) return null;
  return value instanceof Date ? value : new Date(value);
}

export function deriveMatchPlanningStatus(params: {
  roundStatus: string;
  matchStatus: string;
  planningClosedAt: Date | string | null;
  startsAt: Date | string | null;
  liveSessionStartedAt: Date | string | null;
  now?: Date;
}): "planning_open" | "planning_closed" | "live" | "finalized" | "cancelled" {
  const { roundStatus, matchStatus, planningClosedAt, startsAt, liveSessionStartedAt } = params;
  const now = params.now ?? new Date();

  if (matchStatus === "CANCELLED") return "cancelled";
  if (roundStatus === "FINALIZED") return "finalized";

  const liveStarted = toDate(liveSessionStartedAt);
  const closedAt = toDate(planningClosedAt);
  const kickoff = toDate(startsAt);

  if (liveStarted) return "live";
  if (closedAt) return "planning_closed";
  if (kickoff && kickoff <= now) return "planning_closed";

  return "planning_open";
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

export function deriveRoundPlanningStatus(params: {
  roundStatus: string;
  matches: Array<{
    matchStatus: string;
    planningClosedAt: Date | string | null;
    startsAt: Date | string | null;
    liveSessionStartedAt: Date | string | null;
  }>;
  now?: Date;
}): "planning_open" | "planning_closed" | "partially_closed" | "finalized" {
  const { roundStatus, matches } = params;
  const now = params.now ?? new Date();

  if (roundStatus === "FINALIZED") return "finalized";

  const activeMatches = matches.filter((m) => m.matchStatus !== "CANCELLED");

  if (activeMatches.length === 0) {
    return "planning_open";
  }

  const allClosed = activeMatches.every((m) => {
    const liveStarted = toDate(m.liveSessionStartedAt);
    const closedAt = toDate(m.planningClosedAt);
    const kickoff = toDate(m.startsAt);
    if (liveStarted) return true;
    if (closedAt) return true;
    if (kickoff && kickoff <= now) return true;
    return false;
  });

  if (allClosed) return "planning_closed";

  const anyClosed = activeMatches.some((m) => {
    const liveStarted = toDate(m.liveSessionStartedAt);
    const closedAt = toDate(m.planningClosedAt);
    const kickoff = toDate(m.startsAt);
    if (liveStarted) return true;
    if (closedAt) return true;
    if (kickoff && kickoff <= now) return true;
    return false;
  });

  if (anyClosed) return "partially_closed";

  return "planning_open";
}