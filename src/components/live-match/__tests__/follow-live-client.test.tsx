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

type MockClientOptions = { getTicket: () => Promise<string> };

const {
  connectMock,
  getSnapshotMock,
  recordEventMock,
  syncPendingMock,
  RealtimeMatchClientMock,
  fetchRealtimeTicketMock,
} = vi.hoisted(() => {
  const connectMock = vi.fn(async () => {});
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
    _options: unknown,
  ) {
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
      />,
    );

    await waitFor(() => expect(getSnapshotMock).toHaveBeenCalled());

    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
