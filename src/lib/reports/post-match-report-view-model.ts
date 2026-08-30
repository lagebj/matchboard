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
};

export type PostMatchAvailablePlayer = { id: string; name: string; teamName?: string };
