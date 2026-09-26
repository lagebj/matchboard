import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, screen, fireEvent, within } from "@testing-library/react";

/**
 * ADR-0152 §8 — the forgotten-period-start recovery sheet. Trigger A (a coach attempts a normal
 * event while between periods) and the "Start now" / "It started earlier" / "Still in break"
 * outcomes. Trigger B (the automatic break-overrun prompt) is verified by starting the fixture
 * clock already past its own breakDuration+5m threshold, matching this file's sibling
 * (`live-match-client-guardrail-warnings.test.tsx`) convention of using an already-elapsed
 * `startedAt`/transition time rather than advancing fake timers.
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
import { buildPeriodConfigFromFormat } from "@/lib/live-match/period-config";

// The component's `periodConfig` prop reflects the match's resolved format (resolved by the
// server page, not recomputed client-side) — LEAGUE_PERIOD_CONFIG's own hardcoded HALF_TIME
// has no configured duration at all, which would make every break-duration-dependent assertion
// below vacuously pass for the wrong reason. Use a real format-resolved config instead,
// matching the `format` this file's fixtures declare on `activeSession`.
const PERIOD_CONFIG = buildPeriodConfigFromFormat({ numberOfPeriods: 2, periodDurationMinutes: 25, breakDurationMinutes: 10 });

const MIN = 60 * 1000;

function minutesAgo(n: number): string {
  return new Date(Date.now() - n * MIN).toISOString();
}

function makeActions(overrides: {
  recordEvent?: LiveMatchActions["recordEvent"];
  clock?: { period: string; running: boolean; startedAt: string | null; elapsedBeforeStartMs: number };
  lastClockTransitionAt?: string | null;
} = {}): LiveMatchActions {
  return {
    startSession: vi.fn().mockResolvedValue({ success: true, data: { id: "session-1" } }),
    endSession: vi.fn().mockResolvedValue({ success: true, data: {} }),
    heartbeat: vi.fn().mockResolvedValue(undefined),
    recordEvent: overrides.recordEvent ?? vi.fn().mockResolvedValue({ success: true, data: {} }),
    getRecentEvents: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getPreMatchPackage: vi.fn().mockResolvedValue({
      success: true,
      data: {
        squad: [],
        activeSession: {
          id: "session-1",
          coachId: "coach-1",
          startedAt: minutesAgo(60),
          format: { numberOfPeriods: 2, periodDurationMinutes: 25, breakDurationMinutes: 10 },
          clock: overrides.clock ?? { period: "HALF_TIME", running: false, startedAt: null, elapsedBeforeStartMs: 10 * MIN },
          lastClockTransitionAt: overrides.lastClockTransitionAt ?? minutesAgo(10),
        },
      },
    }),
  };
}

function renderClient(actions: LiveMatchActions) {
  render(<LiveMatchClient matchId="match-1" teamName="Home" opponentName="Away" contextLabel={null} periodConfig={PERIOD_CONFIG} actions={actions} />);
}

describe("LiveMatchClient forgotten period-start recovery (ADR-0152 §8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens the recovery sheet instead of recording an event when a normal action is tapped between periods", async () => {
    const recordEvent = vi.fn().mockResolvedValue({ success: true, data: {} });
    const actions = makeActions({ recordEvent, lastClockTransitionAt: minutesAgo(2) });
    renderClient(actions);
    await waitFor(() => expect(actions.getPreMatchPackage).toHaveBeenCalled());

    fireEvent.click(await screen.findByRole("button", { name: "Goal for us" }));

    expect(await screen.findByRole("dialog", { name: "Has second half started?" })).toBeInTheDocument();
    expect(screen.getByText(/still in half time/i)).toBeInTheDocument();
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("'Start now' starts the next period at the current time, records the transition, and enables normal actions", async () => {
    const recordEvent = vi.fn().mockResolvedValue({ success: true, data: {} });
    const actions = makeActions({ recordEvent, lastClockTransitionAt: minutesAgo(2) });
    renderClient(actions);
    fireEvent.click(await screen.findByRole("button", { name: "Goal for us" }));
    const sheet = await screen.findByRole("dialog", { name: "Has second half started?" });

    fireEvent.click(within(sheet).getByRole("button", { name: "Start now" }));

    await waitFor(() => expect(recordEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "PERIOD_START", period: "SECOND_HALF" })));
    expect(screen.queryByRole("dialog", { name: "Has second half started?" })).toBeNull();
    expect(screen.getByRole("button", { name: "Goal for us" })).toBeEnabled();
  });

  it("'It started earlier' opens the duration step, pre-filled with a clamped suggestion, and starting records the transition", async () => {
    // 2 minutes into break-overrun (10-minute break, transitioned 12 minutes ago) suggests 2.
    const recordEvent = vi.fn().mockResolvedValue({ success: true, data: {} });
    const actions = makeActions({ recordEvent, lastClockTransitionAt: minutesAgo(12) });
    renderClient(actions);
    fireEvent.click(await screen.findByRole("button", { name: "Goal for us" }));
    const promptSheet = await screen.findByRole("dialog", { name: "Has second half started?" });
    fireEvent.click(within(promptSheet).getByRole("button", { name: "It started earlier" }));

    const durationSheet = await screen.findByRole("dialog", { name: "When did second half start?" });
    const input = within(durationSheet).getByLabelText("Minutes this period has been running");
    expect(input).toHaveValue(2);

    fireEvent.click(within(durationSheet).getByRole("button", { name: "Start with this time" }));

    await waitFor(() => expect(recordEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "PERIOD_START", period: "SECOND_HALF" })));
    expect(screen.queryByRole("dialog", { name: "When did second half start?" })).toBeNull();
  });

  it("'Still in break' dismisses the sheet without recording anything and suppresses the automatic re-prompt", async () => {
    const recordEvent = vi.fn().mockResolvedValue({ success: true, data: {} });
    // Already well past the auto-prompt threshold (10-minute break + 5m = 15m; 20m elapsed).
    const actions = makeActions({ recordEvent, lastClockTransitionAt: minutesAgo(20) });
    renderClient(actions);

    // Trigger B: the automatic prompt fires on its own, with no tap required.
    const sheet = await screen.findByRole("dialog", { name: "Has second half started?" });
    fireEvent.click(within(sheet).getByRole("button", { name: "Still in break" }));

    expect(screen.queryByRole("dialog", { name: "Has second half started?" })).toBeNull();
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("does not open the recovery sheet before kickoff (no configured break duration to compare against)", async () => {
    const recordEvent = vi.fn().mockResolvedValue({ success: true, data: {} });
    const actions = makeActions({
      recordEvent,
      clock: { period: "BEFORE", running: false, startedAt: null, elapsedBeforeStartMs: 0 },
      lastClockTransitionAt: null,
    });
    renderClient(actions);
    await waitFor(() => expect(actions.getPreMatchPackage).toHaveBeenCalled());

    // Tapping while before kickoff still opens it manually (Trigger A applies to any
    // between-periods state, including before kickoff) — only the automatic Trigger B is
    // scoped out for "before kickoff".
    expect(screen.queryByRole("dialog", { name: /started\?$/ })).toBeNull();
  });
});
