/**
 * Browser-side realtime abstraction (SPEC.md §27). The live-match UI depends on this class,
 * not on `WebSocket` directly. Stage 1 delivers this module standalone and tested — nothing
 * outside `src/lib/live-match/realtime/` imports it yet; Stage 5 wires it into
 * `recordEventLocallyFirst()`.
 *
 * `WebSocketLike` is the minimal subset of the standard WebSocket API this class needs, so
 * tests can inject a fully controllable fake instead of relying on jsdom/Node WebSocket
 * behaviour. The default `createSocket` uses the real global `WebSocket` (available natively
 * in the browser and in Node >=22 per this repo's `engines` field).
 */

import {
  PROTOCOL_VERSION,
  type RpcCall,
  type RpcResult,
  type RpcErrorCode,
  type ClientMethod,
} from "./protocol";
import { parseRawSocketMessage } from "./protocol-schemas";
import { RealtimeVersionTracker, type VersionComparisonResult } from "./realtime-state";
import type { ClientAck } from "./realtime-messages";

export type RealtimeConnectionState =
  | "disabled"
  | "connecting"
  | "authenticating"
  | "connected"
  | "reconnecting"
  | "offline"
  | "error";

export interface WebSocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: "open" | "message" | "close" | "error", listener: (event: unknown) => void): void;
}

const WEBSOCKET_OPEN = 1;

export type ClientCallbackHandler<TParams = unknown> = (params: TParams) => Promise<ClientAck> | ClientAck;

export interface RealtimeMatchClientOptions {
  url: string;
  clientId: string;
  /** Must fetch a *fresh* ticket each call (SPEC.md §27: never reuse an expired ticket for
   * reconnect) — this is why it's a function, not a static value. */
  getTicket: () => Promise<string>;
  createSocket?: (url: string) => WebSocketLike;
  onConnectionStateChange?: (state: RealtimeConnectionState) => void;
  onVersionGap?: (result: VersionComparisonResult) => void;
  callbackHandlers?: Partial<Record<ClientMethod, ClientCallbackHandler>>;
  /** Overridable for tests; defaults to the exponential-backoff+jitter schedule from
   * SPEC.md §27, capped at 30s. */
  reconnectDelayMs?: (attempt: number) => number;
}

interface PendingCall {
  resolve: (result: unknown) => void;
  reject: (error: { code: string; message: string }) => void;
}

const MAX_RECONNECT_DELAY_MS = 30_000;

function defaultReconnectDelay(attempt: number): number {
  const base = Math.min(1000 * 2 ** attempt, MAX_RECONNECT_DELAY_MS);
  const jitter = Math.random() * base * 0.2;
  return Math.min(base + jitter, MAX_RECONNECT_DELAY_MS);
}

function defaultCreateSocket(url: string): WebSocketLike {
  return new WebSocket(url) as unknown as WebSocketLike;
}

export class RealtimeMatchClient {
  private readonly options: RealtimeMatchClientOptions;
  private socket: WebSocketLike | null = null;
  private state: RealtimeConnectionState = "disabled";
  private readonly versionTracker = new RealtimeVersionTracker();
  private readonly pendingCalls = new Map<string, PendingCall>();
  private reconnectAttempt = 0;
  private intentionalDisconnect = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: RealtimeMatchClientOptions) {
    this.options = options;
  }

  get connectionState(): RealtimeConnectionState {
    return this.state;
  }

  get lastAppliedVersion(): number {
    return this.versionTracker.current;
  }

  async connect(): Promise<void> {
    this.intentionalDisconnect = false;
    this.clearReconnectTimer();
    this.setState(this.reconnectAttempt > 0 ? "reconnecting" : "connecting");

    const createSocket = this.options.createSocket ?? defaultCreateSocket;
    const socket = createSocket(this.options.url);
    this.socket = socket;

    socket.addEventListener("open", () => {
      void this.authenticate();
    });
    socket.addEventListener("message", (event) => {
      this.handleRawMessage((event as { data?: unknown }).data);
    });
    socket.addEventListener("close", () => {
      this.handleSocketClosed();
    });
    socket.addEventListener("error", () => {
      this.setState("error");
    });
  }

  disconnect(): void {
    this.intentionalDisconnect = true;
    this.clearReconnectTimer();
    this.socket?.close(1000, "client disconnect");
    this.socket = null;
    this.setState("disabled");
  }

  async recordEvent(params: unknown): Promise<unknown> {
    return this.call("recordEvent", params);
  }

  async getSnapshot(): Promise<unknown> {
    return this.call("getSnapshot", undefined);
  }

  async syncPending(params: unknown): Promise<unknown> {
    return this.call("syncPending", params);
  }

  /** Generic RPC call, matched to its `RpcResult` reply by `id` (SPEC.md §4). */
  call(method: string, params: unknown): Promise<unknown> {
    if (!this.socket || this.socket.readyState !== WEBSOCKET_OPEN) {
      return Promise.reject({ code: "PERSISTENCE_UNAVAILABLE", message: "Not connected." });
    }

    const id = crypto.randomUUID();
    const message: RpcCall = {
      protocol: PROTOCOL_VERSION,
      kind: "call",
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingCalls.set(id, { resolve, reject });
      this.socket!.send(JSON.stringify(message));
    });
  }

  private async authenticate(): Promise<void> {
    this.setState("authenticating");
    try {
      const ticket = await this.options.getTicket();
      await this.call("authenticate", { ticket, clientId: this.options.clientId });
      this.reconnectAttempt = 0;
      this.setState("connected");
    } catch {
      this.setState("error");
      this.socket?.close();
    }
  }

  /**
   * Every message the client receives is validated as "toClient" direction — that governs
   * which method allowlist applies to an incoming *call* (SPEC.md §5.2's callback methods).
   * A `result` message has no method to validate against either allowlist, so direction is
   * irrelevant for that branch; one parse covers both message kinds.
   */
  private handleRawMessage(data: unknown): void {
    if (typeof data !== "string") return;

    const parsed = parseRawSocketMessage(data, "toClient");
    if (!parsed.ok) return;

    if (parsed.message.kind === "call") {
      void this.handleIncomingCall(parsed.message);
    } else {
      this.handleIncomingResult(parsed.message);
    }
  }

  private async handleIncomingCall(call: RpcCall): Promise<void> {
    const handler = this.options.callbackHandlers?.[call.method as ClientMethod];
    if (!handler) {
      this.sendResult(call.id, {
        ok: false,
        error: { code: "METHOD_NOT_FOUND", message: `No handler registered for ${call.method}` },
      });
      return;
    }

    try {
      const ack = await handler(call.params);
      this.sendResult(call.id, { ok: true, result: ack });
    } catch (error) {
      this.sendResult(call.id, {
        ok: false,
        error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Callback failed." },
      });
    }
  }

  private sendResult(
    id: string,
    outcome: { ok: true; result: unknown } | { ok: false; error: { code: RpcErrorCode; message: string } },
  ): void {
    if (!this.socket) return;
    const message: RpcResult = outcome.ok
      ? { protocol: PROTOCOL_VERSION, kind: "result", id, ok: true, result: outcome.result }
      : { protocol: PROTOCOL_VERSION, kind: "result", id, ok: false, error: outcome.error };
    this.socket.send(JSON.stringify(message));
  }

  private handleIncomingResult(result: RpcResult): void {
    const pending = this.pendingCalls.get(result.id);
    if (!pending) return;
    this.pendingCalls.delete(result.id);

    if (result.ok) {
      pending.resolve(result.result);
    } else {
      pending.reject(result.error);
    }
  }

  private handleSocketClosed(): void {
    this.socket = null;
    for (const pending of this.pendingCalls.values()) {
      pending.reject({ code: "SESSION_NOT_FOUND", message: "Connection closed." });
    }
    this.pendingCalls.clear();

    if (this.intentionalDisconnect) {
      this.setState("disabled");
      return;
    }

    this.setState("offline");
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    const delay = (this.options.reconnectDelayMs ?? defaultReconnectDelay)(this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      void this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setState(state: RealtimeConnectionState): void {
    this.state = state;
    this.options.onConnectionStateChange?.(state);
  }
}
