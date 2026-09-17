import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, screen, fireEvent } from "@testing-library/react";

/**
 * 2026-09-17 production incident (second occurrence), Hvit vs Graabein City: a command the
 * coordinator accepted as `"pending"` (client status ACCEPTED_PENDING_PERSISTENCE) whose
 * `eventPersistenceChanged` broadcast never arrived (connection dropped / reload between RPC
 * acceptance and confirmation) stays ACCEPTED_PENDING_PERSISTENCE forever. That status blocks
 * "Finish live reporting" (UNRESOLVED_STATUSES) but is NOT retried by anything
 * (RETRYABLE_STATUSES is only LOCAL_PENDING; recoverInterruptedSends only recovers SENDING) —
 * so the coach is permanently wedged with "1 event could not sync and would be lost" even
 * though the event IS durably persisted in Neon.
 *
 * The fix: reconcile the local outbox against the server's canonical events (Neon is the
 * source of truth, ADR-0138) — a command whose clientEventId exists server-side is PERSISTED
 * regardless of whether the broadcast arrived; an ACCEPTED_PENDING_PERSISTENCE/SENDING command
 * the server does NOT have returns to LOCAL_PENDING (retryable; resend is dedup-safe by
 * clientEventId by design).
 */

const getAllCommandsMock = vi.fn();

vi.mock("@/lib/live-match/local/live-local-store", () => ({
  saveCommandLocally: vi.fn().mockResolvedValue(undefined),
  updateCommandStatus: vi.fn().mockResolvedValue(undefined),
  getNextLocalOrdinal: vi.fn().mockResolvedValue(1),
  getAllCommands: (...args: unknown[]) => getAllCommandsMock(...args),
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
import type { LiveEventSummary } from "@/lib/live-match/live-match-types";

function serverEvent(clientEventId: string, eventType: LiveEventSummary["eventType"] = "GOAL_FOR"): LiveEventSummary {
  return {
    id: `srv-${clientEventId}`,
    eventType,
    period: "FIRST_HALF",
    matchSeconds: 1000,
    wallClockTime: null,
    playerId: null,
    secondaryPlayerId: null,
    isCorrected: false,
    isReversed: false,
    correctsEventId: null,
    positionChange: null,
    clientEventId,
  };
}

function makeActions(serverEvents: LiveEventSummary[]): LiveMatchActions {
  return {
    startSession: vi.fn().mockResolvedValue({ success: true, data: { id: "session-1" } }),
    endSession: vi.fn().mockResolvedValue({ success: true, data: {} }),
    heartbeat: vi.fn().mockResolvedValue(undefined),
    recordEvent: vi.fn().mockResolvedValue({ success: true, data: {} }),
    getRecentEvents: vi.fn().mockResolvedValue({ success: true, data: serverEvents }),
    getPreMatchPackage: vi.fn().mockResolvedValue({
      success: true,
      data: {
        squad: [],
        activeSession: {
          id: "session-1",
          coachId: "coach-1",
          startedAt: new Date().toISOString(),
          clock: { period: "BEFORE", running: false, startedAt: null, elapsedBeforeStartMs: 0 },
        },
      },
    }),
  };
}

/** A local command the coordinator accepted but whose confirmation broadcast was lost —
 * exactly the wedged state from the incident. */
function wedgedPendingPersistenceCommand(clientEventId: string) {
  return {
    clientEventId,
    subjectType: "LEAGUE",
    subjectId: "match-1",
    sessionId: "session-1",
    eventType: "MATCH_END",
    period: "FULL_TIME",
    matchSeconds: null,
    playerId: null,
    secondaryPlayerId: null,
    payload: null,
    correctionType: null,
    correctsEventId: null,
    localOrdinal: 1,
    status: "ACCEPTED_PENDING_PERSISTENCE",
    attemptCount: 1,
    lastAttemptAt: Date.now(),
    createdAt: Date.now(),
  };
}

function wedgedCommandInStore(clientEventId: string) {
  getAllCommandsMock.mockImplementation(async () => [wedgedPendingPersistenceCommand(clientEventId)]);
}

async function openFinishDialogAndConfirm() {
  const finishButton = await screen.findByText("Finish live reporting");
  fireEvent.click(finishButton);
  const confirmButton = await screen.findByRole("button", { name: "Confirm" });
  fireEvent.click(confirmButton);
}

async function renderStarted(actions: LiveMatchActions) {
  render(
    <LiveMatchClient matchId="match-1" teamName="Home" opponentName="Away" contextLabel={null} periodConfig={LEAGUE_PERIOD_CONFIG} actions={actions} />,
  );
  await waitFor(() => expect(actions.getPreMatchPackage).toHaveBeenCalled());
}

describe("LiveMatchClient outbox reconciliation against server-canonical events (ADR-0138 incident fix)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("RED (incident): a wedged ACCEPTED_PENDING_PERSISTENCE MATCH_END that the server DID persist must not block finishing", async () => {
    // The MATCH_END was accepted by the coordinator and persisted to Neon (sequence 37 in the
    // incident), but the confirmation broadcast never arrived, so the local outbox still says
    // ACCEPTED_PENDING_PERSISTENCE. Finish must reconcile against the server and proceed.
    wedgedCommandInStore("evt-match-end");
    const actions = makeActions([serverEvent("evt-match-end", "MATCH_END")]);

    await renderStarted(actions);
    await openFinishDialogAndConfirm();

    // The command the server already persisted must be marked PERSISTED, and the session must
    // be allowed to end (no "could not sync" error).
    await waitFor(() => expect(screen.queryByText(/could not sync and would be lost/i)).toBeNull());
    expect(actions.endSession).toHaveBeenCalled();
  });

  it("a wedged ACCEPTED_PENDING_PERSISTENCE command the server does NOT have returns to retryable LOCAL_PENDING, then blocks finish only while it genuinely cannot sync", async () => {
    // Opposite direction: the broadcast was lost AND the event never persisted. Reconciliation
    // must demote it back to LOCAL_PENDING so the normal retry machinery owns it again — not
    // leave it permanently un-retryable.
    wedgedCommandInStore("evt-lost");
    const actions = makeActions([]); // server has nothing
    (actions.recordEvent as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false, error: "offline" });

    await renderStarted(actions);
    await openFinishDialogAndConfirm();

    // Still blocked from finishing (the event genuinely is not persisted anywhere), but the
    // error is the normal unsynced-block, and the command must have been demoted to retryable.
    await waitFor(() => expect(screen.getByText(/1 event could not sync and would be lost/i)).toBeInTheDocument());
    expect(actions.endSession).not.toHaveBeenCalled();
  });

  // 2026-09-17 CI regression (e2e/live-reporting.spec.ts "blocks finishing the session while
  // events are still unsynced..."): a genuinely offline browser makes `actions.getRecentEvents`
  // reject outright (a real network-level throw), not resolve `{ success: false }` the way the
  // other test above simulates. Before this fix, that uncaught rejection propagated out of
  // `reconcileOutboxWithServer` and aborted `handleEndSession` mid-flight — the function returned
  // before ever reaching its own "could not sync" error, so nothing was shown at all and the
  // e2e test's `await expect(page.getByText(/could not sync and would be lost/i))` timed out.
  it("a rejected (not merely unsuccessful) getRecentEvents call while genuinely offline still surfaces the could-not-sync error, not a silent no-op", async () => {
    wedgedCommandInStore("evt-offline");
    const actions = makeActions([]);
    (actions.getRecentEvents as ReturnType<typeof vi.fn>).mockRejectedValue(new TypeError("Failed to fetch"));

    await renderStarted(actions);
    await openFinishDialogAndConfirm();

    await waitFor(() => expect(screen.getByText(/1 event could not sync and would be lost/i)).toBeInTheDocument());
    expect(actions.endSession).not.toHaveBeenCalled();
  });

  it("reconciliation runs on the periodic event poll, healing a wedged command without a finish attempt", async () => {
    wedgedCommandInStore("evt-heal");
    const actions = makeActions([serverEvent("evt-heal")]);

    await renderStarted(actions);

    // The 5s fetchEvents poll feeds reconciliation; give it a tick. The outbox row must be
    // updated to PERSISTED via updateCommandStatus without any user action.
    const { updateCommandStatus } = await import("@/lib/live-match/local/live-local-store");
    await waitFor(() => expect(updateCommandStatus).toHaveBeenCalledWith("evt-heal", "PERSISTED"), { timeout: 4000 });
  });
});