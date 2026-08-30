import type { MatchReportStatus, GoalType, AssistType } from "@/generated/prisma/client";

export const VALID_REPORT_STATUSES: MatchReportStatus[] = ["DRAFT", "REPORTED", "LOCKED"];
export const COMPLETED_REPORT_STATUSES: MatchReportStatus[] = ["REPORTED", "LOCKED"];

export const VALID_UNPLANNED_APPEARANCE_REASONS: string[] = [
  "EMERGENCY_SQUAD_COVER",
  "LATE_AVAILABILITY_CHANGE",
  "NO_SHOW_REPLACEMENT",
  "INJURY_REPLACEMENT",
  "OTHER_RECORDED_REASON",
];

export const DEFAULT_GOAL_TYPE: GoalType = "NORMAL";
export const DEFAULT_ASSIST_TYPE: AssistType = "NORMAL";

export const VALID_PLANNED_ABSENCE_REASONS: string[] = [
  "INJURED",
  "SICK",
  "AWAY",
  "FAMILY_EVENT",
  "SCHOOL_EVENT",
  "COACH_DECISION",
  "OTHER",
];

export type ReportTransitionResult =
  | { allowed: true; newStatus: MatchReportStatus }
  | { allowed: false; reason: string };

export function canTransitionTo(
  currentStatus: MatchReportStatus | "NOT_STARTED",
  targetStatus: MatchReportStatus,
): ReportTransitionResult {
  // D9/ADR-0109 §E: one meaningful completion boundary (incomplete/editable <-> completed/
  // stable). Reopening a completed report goes straight back to the single editable (DRAFT)
  // state -- there is no coach-visible intermediate "REPORTED" stop to reopen through. REPORTED
  // remains a valid target only for historical/compat reasons (no current writer produces it,
  // see report-mutations.ts).
  const validTransitions: Record<string, MatchReportStatus[]> = {
    NOT_STARTED: ["DRAFT"],
    DRAFT: ["REPORTED", "LOCKED"],
    REPORTED: ["LOCKED", "DRAFT"],
    LOCKED: ["REPORTED", "DRAFT"],
  };

  const allowed = validTransitions[currentStatus];
  if (!allowed) {
    return { allowed: false as const, reason: `Unknown report status: ${currentStatus}` };
  }

  if (!allowed.includes(targetStatus)) {
    return {
      allowed: false as const,
      reason: `Cannot transition from ${currentStatus} to ${targetStatus}. Allowed transitions: ${allowed.join(", ")}`,
    };
  }

  return { allowed: true as const, newStatus: targetStatus };
}

export function isReportEditable(status: MatchReportStatus | "NOT_STARTED"): boolean {
  return status === "DRAFT" || status === "NOT_STARTED";
}

export function isReportCompleted(status: MatchReportStatus | "NOT_STARTED"): boolean {
  return status === "REPORTED" || status === "LOCKED";
}

export function isReportLocked(status: MatchReportStatus | "NOT_STARTED"): boolean {
  return status === "LOCKED";
}

export function hasUnknownAttendance(
  playerActuals: Array<{ attendanceStatus: string }>,
): boolean {
  return playerActuals.some((p) => p.attendanceStatus === "UNKNOWN");
}

export function requireEditableReport(
  status: MatchReportStatus | "NOT_STARTED",
  operation: string,
): { allowed: true } | { allowed: false; reason: string } {
  if (!isReportEditable(status)) {
    return {
      allowed: false,
      reason: `Cannot ${operation}: report status is ${status}, expected DRAFT or NOT_STARTED.`,
    };
  }
  return { allowed: true };
}

export function requireUnlockedReport(
  status: MatchReportStatus | "NOT_STARTED",
  operation: string,
): { allowed: true } | { allowed: false; reason: string } {
  if (isReportLocked(status)) {
    return {
      allowed: false,
      reason: `Cannot ${operation}: report is LOCKED.`,
    };
  }
  return { allowed: true };
}