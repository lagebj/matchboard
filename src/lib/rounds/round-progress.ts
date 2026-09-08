import { hasLeagueMatchPassed } from "@/lib/match-date-utils";

// Additive to, never a replacement for, the round-level selection-planning-completeness
// vocabulary (Not generated / Draft / Blocked / Ready / Finalized — AGENTS.md "Round status
// model"). Since ADR-0101 that vocabulary is internal/secondary for a single match; the primary
// per-match label is the derived lifecycle status. Round progress describes yet another axis —
// has the round actually been played and reported yet (Planning / Partially played / All matches
// played / Reporting / Complete). Surface these side by side; never substitute one for another.
export type RoundProgressStage = "PLANNING" | "PARTIALLY_PLAYED" | "ALL_PLAYED" | "REPORTING" | "COMPLETE";

export type RoundProgressMatchInput = {
  status: string | null;
  startsAt: Date | null;
  reportStatus: "NONE" | "DRAFT" | "REPORTED" | "LOCKED";
};

export type RoundProgress = {
  stage: RoundProgressStage;
  label: string;
  totalMatches: number;
  cancelledMatches: number;
  playedMatches: number;
  completedReports: number;
};

const STAGE_LABELS: Record<RoundProgressStage, string> = {
  PLANNING: "Planning",
  PARTIALLY_PLAYED: "Partially played",
  ALL_PLAYED: "All matches played",
  REPORTING: "Reporting",
  COMPLETE: "Complete",
};

export function deriveRoundProgress(matches: RoundProgressMatchInput[], now?: Date): RoundProgress {
  const reportable = matches.filter((m) => m.status !== "CANCELLED");
  const cancelledMatches = matches.length - reportable.length;
  const playedMatches = reportable.filter((m) => hasLeagueMatchPassed({ startsAt: m.startsAt, status: m.status }, now)).length;
  const completedReports = reportable.filter((m) => m.reportStatus === "REPORTED" || m.reportStatus === "LOCKED").length;

  let stage: RoundProgressStage;
  if (reportable.length === 0 || playedMatches === 0) {
    stage = "PLANNING";
  } else if (playedMatches < reportable.length) {
    stage = "PARTIALLY_PLAYED";
  } else if (completedReports === reportable.length) {
    stage = "COMPLETE";
  } else if (completedReports === 0) {
    stage = "ALL_PLAYED";
  } else {
    stage = "REPORTING";
  }

  return {
    stage,
    label: STAGE_LABELS[stage],
    totalMatches: matches.length,
    cancelledMatches,
    playedMatches,
    completedReports,
  };
}
