/**
 * Canonical shared shape for the post-match report shell (ARR-0034 resolution). League and
 * Event each adapt their own data/actions into this contract; the shell component
 * (`src/components/matches/post-match-report-shell.tsx`) renders it without knowing which
 * source it came from. Only the shell's core (status/lifecycle, result, goals, assists,
 * attendance) is unified here -- League-only concepts with no Event equivalent (planned-squad
 * diff, structured absence, player stats) remain League-only additional sections rendered
 * around the shell, not forced into this contract (see ARR-0034's Resolution criteria: "a
 * decision, documented not silent, on whether structured absence extends to Event" -- the
 * decision is it stays League-only for now).
 */

export type PostMatchLifecycleStatus = "NOT_STARTED" | "DRAFT" | "REPORTED" | "LOCKED";

export type PostMatchReportCapabilities = {
  /** Whether addPlayer accepts an unplanned-appearance reason (League only). */
  hasUnplannedReason: boolean;
};

export type PostMatchReportPlayerRow = {
  /** The report-row id (PostMatchPlayerActual.id / EventPostMatchPlayer.id) -- not the player id. */
  id: string;
  playerId: string;
  playerName: string;
  attendanceStatus: string;
  /** Short inline context, e.g. team name or "Planned helper from X". Rendered, not parsed. */
  meta?: string;
};

export type PostMatchReportGoalRow = {
  id: string;
  playerId: string | null;
  playerName: string | null;
  minute: number | null;
};

export type PostMatchReportAssistRow = {
  id: string;
  playerId: string;
  playerName: string | null;
};

/** ADR-0146 §8/§13 — one `MatchPeriodTimingResolution` row, surfaced for the post-match
 * recovered-timing callout. Symmetric between League and Event (both go through the same
 * `finishLiveReporting`/`timing-review.ts`), so — unlike League-only concepts above — this
 * belongs in the shared contract per ARR-0034's own criterion. */
export type PostMatchReportTimingReviewRow = {
  /** `MatchPeriod` enum value (e.g. "FIRST_HALF") -- opaque to the shell, passed back verbatim
   * to the review/correct actions. */
  period: string;
  periodLabel: string;
  resolvedDurationMinutes: number;
  needsReview: boolean;
};

export type PostMatchReportViewModel = {
  id: string;
  status: PostMatchLifecycleStatus;
  teamLabel: string;
  opponentLabel: string;
  /** Always from the coach's own team's perspective, regardless of League home/away storage. */
  ourScore: number | null;
  opponentScore: number | null;
  players: PostMatchReportPlayerRow[];
  goals: PostMatchReportGoalRow[];
  assists: PostMatchReportAssistRow[];
  completedBy?: string | null;
  completedAt?: string | null;
  /** Every resolved period for this match (reviewed and not-required rows included, for
   * diagnostic completeness) -- empty/absent when Live Reporting never had to resolve an
   * active period. `undefined` (not fetched, e.g. a still-loading async section) is treated
   * the same as an empty array -- never as "definitely nothing to review". */
  timingReview?: PostMatchReportTimingReviewRow[];
  /** Count of recorded events whose period-relative timestamp now falls outside their period's
   * current resolved duration (ADR-0146 §12/D15) -- shown alongside the timing callout, corrected
   * through the existing event-editing workflow, not here. */
  outOfRangeEventCount?: number;
};

export type ActionResult = { success: boolean; error?: string };

export type PostMatchReportActions = {
  updateResult: (data: { ourScore?: number; opponentScore?: number }) => Promise<ActionResult>;
  addGoal: (data: { playerId?: string; minute?: number }) => Promise<ActionResult>;
  removeGoal: (goalId: string) => Promise<ActionResult>;
  addAssist: (data: { playerId: string }) => Promise<ActionResult>;
  removeAssist: (assistId: string) => Promise<ActionResult>;
  updateAttendance: (playerReportId: string, status: string) => Promise<ActionResult>;
  addPlayer: (data: { playerId: string; reason?: string }) => Promise<ActionResult>;
  removePlayer: (playerReportId: string) => Promise<ActionResult>;
  complete: () => Promise<ActionResult>;
  reopen: (target?: "DRAFT" | "REPORTED") => Promise<ActionResult>;
  /** ADR-0146 §14 — confirms a NEEDS_REVIEW period's current resolved duration as-is. Optional:
   * absent when `timingReview` is never populated (a source that hasn't wired the feature yet). */
  confirmPeriodTiming?: (period: string) => Promise<ActionResult>;
  /** ADR-0146 §14 — replaces a NEEDS_REVIEW period's resolved duration with a coach-supplied
   * value (minutes) and marks it reviewed. */
  correctPeriodTiming?: (period: string, correctedDurationMinutes: number) => Promise<ActionResult>;
};

export type PostMatchAvailablePlayer = { id: string; name: string; teamName?: string };
