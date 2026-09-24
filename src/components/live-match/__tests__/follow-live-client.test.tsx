import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { FollowLiveClient } from "../follow-live-client";

/**
 * Regression/contract test for "Follow Live" being strictly read-only (production
 * consistency pass item #6). Server-side enforcement (the "view" ticket's capabilities,
 * checked by the Durable Object) is the real security boundary and is covered by
 * src/app/api/live-match/[matchId]/realtime-ticket/__tests__/route.test.ts. This test
 * covers the client contract: FollowLiveClient must request a "view" ticket (never
 * "report") and must never call a mutating RPC method, and its rendered output must
 * contain no actionable match-management control.
 */

type MockClientOptions = {
  getTicket: () => Promise<string>;
  onConnectionStateChange?: (state: string) => void;
};

const {
  connectMock,
  getSnapshotMock,
  recordEventMock,
  syncPendingMock,
  RealtimeMatchClientMock,
  fetchRealtimeTicketMock,
} = vi.hoisted(() => {
  // Mirrors the real `RealtimeMatchClient`: `connect()` resolving does NOT itself mean
  // authenticated — `onConnectionStateChange("connected")` fires separately, once the socket
  // has actually opened and the "authenticate" RPC has succeeded. FollowLiveClient's snapshot
  // sync is wired off that callback (see the 2026-09-23 incident regression test below), so the
  // mock must fire it too, or every test relying on the initial snapshot loading would hang.
  const connectMock = vi.fn(async function (this: { __options?: MockClientOptions }) {
    this.__options?.onConnectionStateChange?.("connected");
  });
  const getSnapshotMock = vi.fn(async () => ({
    version: 1,
    events: [],
    presence: { connectedCount: 1 },
    session: { status: "ACTIVE" },
  }));
  const disconnectMock = vi.fn();
  const recordEventMock = vi.fn();
  const syncPendingMock = vi.fn();
  const RealtimeMatchClientMock = vi.fn(function MockRealtimeMatchClient(
    this: Record<string, unknown>,
    options: unknown,
  ) {
    this.__options = options;
    this.connect = connectMock;
    this.getSnapshot = getSnapshotMock;
    this.disconnect = disconnectMock;
    this.recordEvent = recordEventMock;
    this.syncPending = syncPendingMock;
  });
  const fetchRealtimeTicketMock = vi.fn(async (_matchId: string, _mode: "report" | "view") => "fake-ticket");
  return {
    connectMock,
    getSnapshotMock,
    recordEventMock,
    syncPendingMock,
    RealtimeMatchClientMock,
    fetchRealtimeTicketMock,
  };
});

vi.mock("@/lib/live-match/realtime/realtime-client", () => ({
  RealtimeMatchClient: RealtimeMatchClientMock,
}));

vi.mock("@/lib/live-match/realtime/fetch-ticket", () => ({
  fetchRealtimeTicket: (matchId: string, mode: "report" | "view") => fetchRealtimeTicketMock(matchId, mode),
}));

describe("FollowLiveClient (read-only)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_LIVE_MATCH_REALTIME_URL = "wss://example.test";
  });

  it("requests a 'view' ticket, never 'report'", async () => {
    render(
      <FollowLiveClient
        matchId="match-1"
        teamName="Blue"
        opponentName="Red"
        homeAway="HOME"
        playerMap={{}}
        squad={[]}
      />,
    );

    await waitFor(() => expect(connectMock).toHaveBeenCalled());

    const ctorCall = RealtimeMatchClientMock.mock.calls[0]![0] as MockClientOptions;
    await ctorCall.getTicket();

    expect(fetchRealtimeTicketMock).toHaveBeenCalledWith("match-1", "view");
    expect(fetchRealtimeTicketMock).not.toHaveBeenCalledWith("match-1", "report");
  });

  it("never calls a mutating RPC method (recordEvent/syncPending)", async () => {
    render(
      <FollowLiveClient
        matchId="match-1"
        teamName="Blue"
        opponentName="Red"
        homeAway="HOME"
        playerMap={{}}
        squad={[]}
      />,
    );

    await waitFor(() => expect(getSnapshotMock).toHaveBeenCalled());

    expect(recordEventMock).not.toHaveBeenCalled();
    expect(syncPendingMock).not.toHaveBeenCalled();
  });

  it("renders no actionable button or control", async () => {
    render(
      <FollowLiveClient
        matchId="match-1"
        teamName="Blue"
        opponentName="Red"
        homeAway="HOME"
        playerMap={{}}
        squad={[]}
      />,
    );

    await waitFor(() => expect(getSnapshotMock).toHaveBeenCalled());

    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  // ADR-0146 (bundle §05.16): a guardrails warning may be *shown* read-only, but must not
  // reintroduce mutation controls — no Continue/Finish actions for a viewer.
  it("renders the strong guardrails warning with no action buttons when the session is past 240 minutes", async () => {
    render(
      <FollowLiveClient
        matchId="match-1"
        teamName="Blue"
        opponentName="Red"
        homeAway="HOME"
        playerMap={{}}
        squad={[]}
        liveReportingStartedAt={new Date(Date.now() - 245 * 60 * 1000).toISOString()}
        sessionFormat={{ numberOfPeriods: 2, periodDurationMinutes: 25, breakDurationMinutes: 10 }}
      />,
    );

    expect(await screen.findByTestId("live-strong-warning")).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByText(/Continue live reporting/i)).toBeNull();
    expect(screen.queryByText(/Finish live reporting/i)).toBeNull();
  });

  // 2026-09-23 incident (Hvit v Huringen 1): the viewer's WebSocket reconnected repeatedly
  // during the match (network churn — see `RealtimeMatchClient`'s own reconnect/backoff logic),
  // but the original implementation only ever fetched `getSnapshot()` once, tied to the very
  // first `connect()` call — a connection that reconnects mid-match never re-syncs, so any
  // event broadcast while it happened to be offline is permanently invisible to the coach
  // watching along. The component's own header comment documents the intended contract ("5. On
  // refresh/reconnect, re-derive everything from the fresh snapshot") — this proves it.
  it("re-fetches the snapshot on every reconnect, not just the initial connect", async () => {
    render(
      <FollowLiveClient
        matchId="match-1"
        teamName="Blue"
        opponentName="Red"
        homeAway="HOME"
        playerMap={{}}
        squad={[]}
      />,
    );

    await waitFor(() => expect(getSnapshotMock).toHaveBeenCalledTimes(1));

    const ctorCall = RealtimeMatchClientMock.mock.calls[0]![0] as MockClientOptions;
    ctorCall.onConnectionStateChange?.("reconnecting");
    ctorCall.onConnectionStateChange?.("connected");

    await waitFor(() => expect(getSnapshotMock).toHaveBeenCalledTimes(2));
  });

  it("shows no guardrails warning without liveReportingStartedAt (legacy caller contract unchanged)", async () => {
    render(
      <FollowLiveClient
        matchId="match-1"
        teamName="Blue"
        opponentName="Red"
        homeAway="HOME"
        playerMap={{}}
        squad={[]}
      />,
    );

    await waitFor(() => expect(getSnapshotMock).toHaveBeenCalled());

    expect(screen.queryByTestId("live-strong-warning")).toBeNull();
    expect(screen.queryByTestId("live-legacy-fallback-warning")).toBeNull();
  });
});
