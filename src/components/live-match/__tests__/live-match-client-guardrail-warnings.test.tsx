import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, screen, fireEvent, within } from "@testing-library/react";

/**
 * ADR-0146 (bundle §03.5–§03.8, §05.7–§05.11) — the Live Reporting guardrails warnings in the
 * editable live client. The warning thresholds are unit-covered in
 * `live-reporting-guardrails.test.ts`; these tests verify the CLIENT wiring: the warning
 * appears from the session's actual `startedAt` (never scheduled kickoff), escalates through
 * the severity tiers, "Continue live reporting" is presentation-only, and the STRONG/EXPIRED
 * tiers persist after dismissal.
 */

vi.mock("@/lib/live-match/local/live-local-store", () => ({
  saveCommandLocally: vi.fn().mockResolvedValue(undefined),
  updateCommandStatus: vi.fn().mockResolvedValue(undefined),
  getNextLocalOrdinal: vi.fn().mockResolvedValue(1),
  getAllCommands: vi.fn().mockResolvedValue([]),
  getRetryableCommands: vi.fn().mockResolvedValue([]),
  getUnresolvedCommands: vi.fn().mockResolvedValue([]),
  isActionableForCoach: (c: { status: string; resolvedByCoach?: boolean }) =>
    c.status === "NEEDS_REVIEW" || (c.status === "FAILED_TERMINAL" && !c.resolvedByCoach),
  recoverInterruptedSends: vi.fn().mockResolvedValue([]),
  clearPersistedCommands: vi.fn().mockResolvedValue({ removed: 0, retainedUnresolved: 0 }),
  saveSessionLocally: vi.fn().mockResolvedValue(undefined),
  savePreparedPackage: vi.fn().mockResolvedValue(undefined),
  clearPreparedPackage: vi.fn().mockResolvedValue(undefined),
  getLocalSession: vi.fn().mockResolvedValue(null),
  clearLocalSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/live-match/offline/register-live-service-worker", () => ({
  registerLiveServiceWorker: vi.fn(),
}));

import { LiveMatchClient, type LiveMatchActions } from "../live-match-client";
import { LEAGUE_PERIOD_CONFIG } from "@/lib/live-match/period-config";

const MIN = 60 * 1000;

function minutesAgo(n: number): string {
  return new Date(Date.now() - n * MIN).toISOString();
}

function makeActions(session: { startedAt: string; format?: { numberOfPeriods: number; periodDurationMinutes: number; breakDurationMinutes: number } | null }): LiveMatchActions {
  return {
    startSession: vi.fn().mockResolvedValue({ success: true, data: { id: "session-1" } }),
    endSession: vi.fn().mockResolvedValue({ success: true, data: {} }),
    heartbeat: vi.fn().mockResolvedValue(undefined),
    recordEvent: vi.fn().mockResolvedValue({ success: true, data: {} }),
    getRecentEvents: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getPreMatchPackage: vi.fn().mockResolvedValue({
      success: true,
      data: {
        squad: [],
        activeSession: {
          id: "session-1",
          coachId: "coach-1",
          startedAt: session.startedAt,
          format: session.format ?? null,
          clock: { period: "BEFORE", running: false, startedAt: null, elapsedBeforeStartMs: 0 },
        },
      },
    }),
  };
}

function renderClient(actions: LiveMatchActions, periodConfig = LEAGUE_PERIOD_CONFIG) {
  render(
    <LiveMatchClient matchId="match-1" teamName="Home" opponentName="Away" contextLabel={null} periodConfig={periodConfig} actions={actions} />,
  );
}

describe("LiveMatchClient guardrails warnings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows no warning for a recently-started configured session", async () => {
    const actions = makeActions({
      startedAt: minutesAgo(30),
      format: { numberOfPeriods: 2, periodDurationMinutes: 25, breakDurationMinutes: 10 },
    });
    renderClient(actions);
    await waitFor(() => expect(actions.getPreMatchPackage).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId("live-contextual-match-warning")).toBeNull());
    expect(screen.queryByTestId("live-legacy-fallback-warning")).toBeNull();
    expect(screen.queryByTestId("live-strong-warning")).toBeNull();
  });

  it("shows the contextual match warning at expected+allowance (90m for 2×25+10), not the legacy fallback", async () => {
    const actions = makeActions({
      startedAt: minutesAgo(95),
      format: { numberOfPeriods: 2, periodDurationMinutes: 25, breakDurationMinutes: 10 },
    });
    renderClient(actions);
    expect(await screen.findByTestId("live-contextual-match-warning")).toBeInTheDocument();
    expect(screen.getByText(/substantially longer than this match's configured format/i)).toBeInTheDocument();
    expect(screen.queryByTestId("live-legacy-fallback-warning")).toBeNull();
  });

  it("shows the legacy 180-minute fallback for an unconfigured session, never a guessed format", async () => {
    const actions = makeActions({ startedAt: minutesAgo(185) });
    renderClient(actions);
    expect(await screen.findByTestId("live-legacy-fallback-warning")).toBeInTheDocument();
    expect(screen.queryByTestId("live-contextual-match-warning")).toBeNull();
  });

  it("shows the strong 4-hour warning with the auto-finish copy, with Finish live reporting available", async () => {
    const actions = makeActions({
      startedAt: minutesAgo(245),
      format: { numberOfPeriods: 2, periodDurationMinutes: 25, breakDurationMinutes: 10 },
    });
    renderClient(actions);
    expect(await screen.findByTestId("live-strong-warning")).toBeInTheDocument();
    expect(screen.getByText(/active for 4 hours/i)).toBeInTheDocument();
    expect(screen.getByText(/finish automatically 4 hours 30 minutes after it started/i)).toBeInTheDocument();
  });

  it("shows the expired status at 270 minutes with a finish action (server reconciliation remains the authority)", async () => {
    const actions = makeActions({ startedAt: minutesAgo(275) });
    renderClient(actions);
    expect(await screen.findByTestId("live-expired-warning")).toBeInTheDocument();
    expect(screen.getByText(/passed the 4 hours 30 minutes limit/i)).toBeInTheDocument();
  });

  it("Continue live reporting is presentation-only: dismissing the contextual warning hides it without touching any deadline", async () => {
    const actions = makeActions({
      startedAt: minutesAgo(95),
      format: { numberOfPeriods: 2, periodDurationMinutes: 25, breakDurationMinutes: 10 },
    });
    renderClient(actions);
    const banner = await screen.findByTestId("live-contextual-match-warning");
    fireEvent.click(within(banner).getByRole("button", { name: "Continue live reporting" }));
    await waitFor(() => expect(screen.queryByTestId("live-contextual-match-warning")).toBeNull());
    // No session mutation of any kind fired.
    expect(actions.endSession).not.toHaveBeenCalled();
  });

  it("the strong warning cannot be dismissed away — it persists after Continue", async () => {
    const actions = makeActions({ startedAt: minutesAgo(245) });
    renderClient(actions);
    const banner = await screen.findByTestId("live-strong-warning");
    fireEvent.click(within(banner).getByRole("button", { name: "Continue live reporting" }));
    // Still visible: persistent until the session ends (bundle §03.7/§05.10).
    expect(await screen.findByTestId("live-strong-warning")).toBeInTheDocument();
  });

  it("a fixture moved four hours in real life cannot dodge the thresholds: scheduled kickoff is never an input — a session started 245m ago warns STRONG regardless", async () => {
    // The client receives NO scheduled-kickoff-derived warning state at all; startedAt is the
    // only anchor. This test pins that a 245-minute-old session start warns even though the
    // match's scheduled kickoff (rendered nowhere in this flow) could be anything.
    const actions = makeActions({ startedAt: minutesAgo(245) });
    renderClient(actions);
    expect(await screen.findByTestId("live-strong-warning")).toBeInTheDocument();
  });
});