import { describe, it, expect, vi } from "vitest";
import {
  RealtimeMatchClient,
  type WebSocketLike,
  type RealtimeConnectionState,
  type RealtimeMatchClientOptions,
} from "../realtime-client";
import { PROTOCOL_VERSION } from "../protocol";

const WS_CONNECTING = 0;
const WS_OPEN = 1;
const WS_CLOSED = 3;

class FakeSocket implements WebSocketLike {
  readyState = WS_CONNECTING;
  sent: string[] = [];
  private listeners: Record<string, Array<(event: unknown) => void>> = {};

  addEventListener(type: "open" | "message" | "close" | "error", listener: (event: unknown) => void): void {
    (this.listeners[type] ??= []).push(listener);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = WS_CLOSED;
    this.emit("close", {});
  }

  emit(type: string, event: unknown): void {
    for (const listener of this.listeners[type] ?? []) listener(event);
  }

  simulateOpen(): void {
    this.readyState = WS_OPEN;
    this.emit("open", {});
  }

  simulateMessage(data: unknown): void {
    this.emit("message", { data: JSON.stringify(data) });
  }

  lastSent(): unknown {
    return JSON.parse(this.sent[this.sent.length - 1]);
  }
}

function buildClient(overrides: Partial<RealtimeMatchClientOptions> = {}) {
  const sockets: FakeSocket[] = [];
  const states: RealtimeConnectionState[] = [];
  const getTicket = vi.fn().mockResolvedValue("fake-ticket");

  const client = new RealtimeMatchClient({
    url: "wss://example.test/matches/m1",
    clientId: "client-1",
    getTicket,
    createSocket: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    onConnectionStateChange: (state) => states.push(state),
    reconnectDelayMs: () => 0,
    ...overrides,
  });

  return { client, sockets, states, getTicket };
}

async function connectAndAuthenticate(client: RealtimeMatchClient, sockets: FakeSocket[]) {
  const connectPromise = client.connect();
  await connectPromise;
  const socket = sockets[sockets.length - 1];
  socket.simulateOpen();
  await Promise.resolve();
  await Promise.resolve();
  const authCall = socket.lastSent() as { id: string; method: string };
  expect(authCall.method).toBe("authenticate");
  socket.simulateMessage({
    protocol: PROTOCOL_VERSION,
    kind: "result",
    id: authCall.id,
    ok: true,
    result: { authenticated: true, connectionId: "conn-1" },
  });
  await Promise.resolve();
  await Promise.resolve();
  return socket;
}

describe("RealtimeMatchClient — connection lifecycle", () => {
  it("sends authenticate as the first call after the socket opens", async () => {
    const { client, sockets } = buildClient();
    await connectAndAuthenticate(client, sockets);
    expect(client.connectionState).toBe("connected");
  });

  it("fetches a fresh ticket for authentication", async () => {
    const { client, sockets, getTicket } = buildClient();
    await connectAndAuthenticate(client, sockets);
    expect(getTicket).toHaveBeenCalledTimes(1);
  });

  it("transitions through connecting -> authenticating -> connected", async () => {
    const { client, sockets, states } = buildClient();
    await connectAndAuthenticate(client, sockets);
    expect(states).toEqual(["connecting", "authenticating", "connected"]);
  });

  it("disconnect() is intentional and does not trigger reconnect", async () => {
    const { client, sockets, states } = buildClient();
    const socket = await connectAndAuthenticate(client, sockets);
    client.disconnect();
    expect(socket.readyState).toBe(WS_CLOSED);
    expect(states[states.length - 1]).toBe("disabled");
    expect(sockets.length).toBe(1);
  });

  it("reconnects with a fresh ticket after an unexpected close", async () => {
    const { client, sockets, getTicket } = buildClient();
    const socket = await connectAndAuthenticate(client, sockets);

    // Simulate the server dropping the connection (not client.disconnect()).
    socket.readyState = WS_CLOSED;
    socket.emit("close", {});

    // Reconnect is scheduled asynchronously (setTimeout with 0 delay in this test).
    await new Promise((resolve) => setTimeout(resolve, 5));
    await Promise.resolve();

    expect(sockets.length).toBe(2);
    const newSocket = sockets[1];
    newSocket.simulateOpen();
    await Promise.resolve();
    await Promise.resolve();

    expect(getTicket).toHaveBeenCalledTimes(2);
  });
});

describe("RealtimeMatchClient — call()", () => {
  it("rejects a call when not connected", async () => {
    const { client } = buildClient();
    await expect(client.call("getSnapshot", undefined)).rejects.toMatchObject({ code: "PERSISTENCE_UNAVAILABLE" });
  });

  it("resolves a call when the matching result arrives", async () => {
    const { client, sockets } = buildClient();
    const socket = await connectAndAuthenticate(client, sockets);

    const callPromise = client.getSnapshot();
    const sent = socket.lastSent() as { id: string; method: string };
    expect(sent.method).toBe("getSnapshot");

    socket.simulateMessage({
      protocol: PROTOCOL_VERSION,
      kind: "result",
      id: sent.id,
      ok: true,
      result: { version: 7 },
    });

    await expect(callPromise).resolves.toEqual({ version: 7 });
  });

  it("rejects a call when the matching result is a failure", async () => {
    const { client, sockets } = buildClient();
    const socket = await connectAndAuthenticate(client, sockets);

    const callPromise = client.recordEvent({ clientEventId: "evt-1" });
    const sent = socket.lastSent() as { id: string };

    socket.simulateMessage({
      protocol: PROTOCOL_VERSION,
      kind: "result",
      id: sent.id,
      ok: false,
      error: { code: "STALE_STATE", message: "stale", currentVersion: 9 },
    });

    await expect(callPromise).rejects.toMatchObject({ code: "STALE_STATE", currentVersion: 9 });
  });
});

describe("RealtimeMatchClient — incoming server calls (callback RPC)", () => {
  it("dispatches a known callback method and replies with the handler's ack", async () => {
    const handler = vi.fn().mockResolvedValue({ acknowledged: true });
    const { client, sockets } = buildClient({ callbackHandlers: { applyEvent: handler } });
    const socket = await connectAndAuthenticate(client, sockets);

    socket.simulateMessage({
      protocol: PROTOCOL_VERSION,
      kind: "call",
      id: "srv-call-1",
      method: "applyEvent",
      params: { version: 5, event: { id: "e1" } },
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(handler).toHaveBeenCalledWith({ version: 5, event: { id: "e1" } });
    const reply = socket.lastSent() as { id: string; ok: boolean; result: unknown };
    expect(reply.id).toBe("srv-call-1");
    expect(reply.ok).toBe(true);
  });

  it("replies METHOD_NOT_FOUND for a known protocol method with no registered handler", async () => {
    const { client, sockets } = buildClient();
    const socket = await connectAndAuthenticate(client, sockets);

    socket.simulateMessage({
      protocol: PROTOCOL_VERSION,
      kind: "call",
      id: "srv-call-2",
      method: "presenceChanged",
      params: { connectedCount: 2 },
    });
    await Promise.resolve();
    await Promise.resolve();

    const reply = socket.lastSent() as { id: string; ok: boolean; error: { code: string } };
    expect(reply.ok).toBe(false);
    expect(reply.error.code).toBe("METHOD_NOT_FOUND");
  });
});
