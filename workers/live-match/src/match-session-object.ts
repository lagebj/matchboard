/**
 * `MatchSessionObject` — the Cloudflare Durable Object (SPEC.md §3, §14). Exactly one instance
 * exists per Matchboard match (`env.MATCH_SESSIONS.idFromName(matchId)`, done by `index.ts`,
 * not here).
 *
 * This class owns only I/O (WebSocket Hibernation API, Durable Object storage, the internal
 * persistence HTTP call) and defers every real decision to the pure functions in `./state.ts`
 * — see that file's header for why, and `../test/state.test.ts` for the behavioural test
 * matrix this split makes possible.
 *
 * SPEC.md §20 steps 6-10 (Stage 4, "signed internal persistence API"): `handleRecordEvent`'s
 * "accepted" branch now signs and sends the event to `POST /api/internal/live-match/events`
 * (`./internal-client.ts`) *within the same RPC call*, awaited before responding — deliberately
 * not fire-and-forget, since nothing here extends this Durable Object's execution past the
 * point `webSocketMessage` returns (no `waitUntil`-equivalent for an already-hibernatable
 * object), so an un-awaited persistence call could be interrupted before it completes. On
 * success, `persistenceStatus` becomes `"persisted"` and the real canonical event (from
 * Neon, via Vercel) replaces the placeholder broadcast. On failure, `persistenceStatus` stays
 * `"pending"` exactly as before this stage — retrying it is explicitly Stage 6's outbox/alarm
 * scope, not built here (see that method's own comment for the exact boundary).
 *
 * SPEC.md §5.2 client-callback acknowledgement is deliberately NOT implemented as a
 * request/response with a timeout in this stage: nothing here needs to wait for or react to
 * a client's ack (`ClientAck` carries no version to reconcile against, and no Stage 3 state
 * transition is gated on it), so callbacks are sent fire-and-forget via `ws.send()`, which
 * already satisfies §5.2's real requirement ("a slow or suspended client must never block
 * other clients or block a match mutation from succeeding") without needing pending-call
 * bookkeeping at all. `webSocketMessage` still handles an incoming `result` message
 * gracefully (as a no-op) rather than erroring, in case a future stage's client actually
 * sends one.
 */

import { DurableObject } from "cloudflare:workers";
import { parseRawSocketMessage } from "../../../src/lib/live-match/realtime/protocol-schemas";
import {
  PRE_AUTH_ALLOWED_METHOD,
  type RpcCall,
  type RpcResult,
  type ClientMethod,
} from "../../../src/lib/live-match/realtime/protocol";
import type {
  AuthenticateInput,
  AttachResult,
  RecordEventCommand,
  RecordEventResult,
  SyncPendingCommand,
  SyncPendingResult,
  EndSessionCommand,
  EndSessionResult,
  ApplyEventCallback,
  PersistenceChangedCallback,
  PresenceChangedCallback,
  SessionEndedCallback,
  CanonicalLiveEvent,
  InternalPersistEventRequest,
  MatchSessionSnapshot,
  LiveMatchRealtimeTicket,
} from "../../../src/lib/live-match/realtime/realtime-messages";
import { verifyRealtimeTicket } from "./auth";
import { rpcOk, rpcFail, buildClientCall } from "./rpc";
import { persistEvent, PersistEventError } from "./internal-client";
import {
  evaluateAuthenticate,
  evaluateRecordEvent,
  evaluateSyncPending,
  evaluateEndSession,
  hasReportCapability,
  type SessionMeta,
  type AcceptedEventRecord,
} from "./state";
import type { Env } from "./worker-types";

/** SPEC.md §12 — per-socket metadata preserved across hibernation via
 * `serializeAttachment`/`deserializeAttachment`. `capabilities` (added for "Follow live") is
 * copied verbatim from the verified ticket at authenticate time — see `hasReportCapability()`
 * in `./state.ts` for the enforcement this exists to support. */
interface ConnectionAttachment {
  authenticated: boolean;
  connectionId: string;
  clientId: string;
  userId: string;
  organisationId: string;
  sessionId: string;
  authValidUntil: number;
  lastAckVersion: number;
  capabilities: string[];
}

const UNAUTHENTICATED_ATTACHMENT: Omit<ConnectionAttachment, "connectionId"> = {
  authenticated: false,
  clientId: "",
  userId: "",
  organisationId: "",
  sessionId: "",
  authValidUntil: 0,
  lastAckVersion: 0,
  capabilities: [],
};

export class MatchSessionObject extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  /**
   * Only ever called by `index.ts` after it has already validated the Upgrade header,
   * Origin allowlist, and matchId shape — this method trusts that validation rather than
   * repeating it, per SPEC.md §14's Worker/Durable-Object layering (routing/validation in
   * the Worker, session logic in the object).
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const routedMatchId = url.pathname.match(/^\/matches\/([^/]+)$/)?.[1];
    if (!routedMatchId) {
      return new Response("Not found", { status: 404 });
    }
    // Persisted (not just held in memory) because a later `authenticate` call may run after
    // a hibernation wake, where `fetch` itself does not re-run (SPEC.md §16).
    await this.ctx.storage.put("routedMatchId", routedMatchId);

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const connectionId = crypto.randomUUID();
    this.ctx.acceptWebSocket(server, ["live-match"]);
    server.serializeAttachment({ ...UNAUTHENTICATED_ATTACHMENT, connectionId } satisfies ConnectionAttachment);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") {
      ws.close(1003, "Binary messages are not supported");
      return;
    }

    const parsed = parseRawSocketMessage(message, "toSession");
    if (!parsed.ok) {
      const id = extractIdIfPresent(message);
      if (id) {
        ws.send(JSON.stringify(rpcFail(id, parsed.code, parsed.reason)));
      }
      return;
    }

    if (parsed.message.kind === "result") {
      // SPEC.md §5.2 client ack — no-op in Stage 3, see file header.
      return;
    }

    const call = parsed.message;
    const attachment = ws.deserializeAttachment() as ConnectionAttachment | null;
    if (!attachment) {
      ws.close(1011, "Missing connection state");
      return;
    }

    if (!attachment.authenticated && call.method !== PRE_AUTH_ALLOWED_METHOD) {
      ws.send(JSON.stringify(rpcFail(call.id, "AUTH_REQUIRED", "Authenticate before calling other methods.")));
      ws.close(4401, "Not authenticated");
      return;
    }

    const result = await this.dispatch(ws, attachment, call);
    ws.send(JSON.stringify(result));
  }

  async webSocketClose(_ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): Promise<void> {
    await this.broadcastPresence();
  }

  async webSocketError(_ws: WebSocket, _error: unknown): Promise<void> {
    await this.broadcastPresence();
  }

  private async dispatch(ws: WebSocket, attachment: ConnectionAttachment, call: RpcCall): Promise<RpcResult> {
    switch (call.method) {
      case "authenticate":
        return this.handleAuthenticate(ws, attachment, call);
      case "getSnapshot":
        return this.handleGetSnapshot(call);
      case "recordEvent":
        return this.handleRecordEvent(attachment, call);
      case "syncPending":
        return this.handleSyncPending(call);
      case "endSession":
        return this.handleEndSession(attachment, call);
      default:
        return rpcFail(call.id, "METHOD_NOT_FOUND", `Unknown method: ${call.method}`);
    }
  }

  private async handleAuthenticate(ws: WebSocket, attachment: ConnectionAttachment, call: RpcCall): Promise<RpcResult> {
    const params = call.params as Partial<AuthenticateInput> | undefined;
    if (!params || typeof params.ticket !== "string" || typeof params.clientId !== "string") {
      return rpcFail(call.id, "INVALID_PARAMS", "authenticate requires { ticket, clientId }.");
    }

    let ticket: LiveMatchRealtimeTicket;
    try {
      ticket = await verifyRealtimeTicket(params.ticket, this.env.LIVE_MATCH_REALTIME_SECRET);
    } catch {
      // `verifyRealtimeTicket` (jose `jwtVerify`) already rejects an expired token before
      // returning, collapsed into this one generic error — it does not currently distinguish
      // "expired" from "otherwise invalid" for the caller to re-surface as `AUTH_EXPIRED`.
      // A separate `ticket.exp` re-check here would never fire (expiry is already enforced
      // above) and was removed as dead code. `AUTH_EXPIRED` remains a valid protocol error
      // code (`protocol.ts`) for whenever that distinction is worth threading through.
      return rpcFail(call.id, "AUTH_INVALID", "Invalid or expired realtime ticket.");
    }

    const routedMatchId = await this.ctx.storage.get<string>("routedMatchId");
    if (!routedMatchId) {
      return rpcFail(call.id, "INTERNAL_ERROR", "Connection was not routed to a match.");
    }

    const existingMeta = (await this.ctx.storage.get<SessionMeta>("meta")) ?? null;
    const decision = evaluateAuthenticate({
      routedMatchId,
      ticket: { matchId: ticket.matchId, sessionId: ticket.sessionId, organisationId: ticket.organisationId },
      existingMeta,
      now: Date.now(),
    });

    if (decision.outcome === "match_mismatch" || decision.outcome === "session_mismatch") {
      return rpcFail(call.id, "FORBIDDEN", "Ticket does not match this session.");
    }

    if (decision.outcome === "initialize") {
      if (existingMeta) {
        await this.clearAcceptedEvents();
      }
      await this.ctx.storage.put("meta", decision.meta);
    }

    const updated: ConnectionAttachment = {
      authenticated: true,
      connectionId: attachment.connectionId,
      clientId: params.clientId,
      userId: ticket.userId,
      organisationId: ticket.organisationId,
      sessionId: ticket.sessionId,
      authValidUntil: ticket.exp * 1000,
      lastAckVersion: 0,
      capabilities: ticket.capabilities,
    };
    ws.serializeAttachment(updated);

    await this.broadcastPresence();

    const result: AttachResult = { authenticated: true, connectionId: attachment.connectionId };
    return rpcOk(call.id, result);
  }

  private async handleGetSnapshot(call: RpcCall): Promise<RpcResult> {
    const meta = await this.ctx.storage.get<SessionMeta>("meta");
    if (!meta) {
      return rpcFail(call.id, "SESSION_NOT_FOUND", "No session has been established yet.");
    }

    const accepted = await this.listAcceptedEvents();
    const pendingClientEventIds = accepted
      .filter((event) => event.persistenceStatus === "pending")
      .map((event) => event.clientEventId);

    const snapshot: MatchSessionSnapshot = {
      protocolVersion: 1,
      version: meta.version,
      session: {
        sessionId: meta.sessionId,
        matchId: meta.matchId,
        status: meta.endedAt === null ? "ACTIVE" : "ENDED",
      },
      clock: meta.clockAnchor,
      // Deliberately still empty: this object's own accepted-event storage (populated by
      // handleRecordEvent, Stage 4) already covers "what has this object seen," but a
      // reconnecting client also needs canonical events an HTTP-fallback write persisted
      // *without* this object ever seeing them — that reconciliation against the internal
      // snapshot endpoint (SPEC.md §23) is Stage 6 scope, not built here.
      events: [],
      persistence: { pendingClientEventIds },
      presence: { connectedCount: this.countAuthenticatedConnections() },
    };
    return rpcOk(call.id, snapshot);
  }

  private async handleRecordEvent(attachment: ConnectionAttachment, call: RpcCall): Promise<RpcResult> {
    if (!hasReportCapability(attachment.capabilities)) {
      return rpcFail(call.id, "FORBIDDEN", "This connection is view-only and cannot record events.");
    }

    const params = call.params as Partial<RecordEventCommand> | undefined;
    if (
      !params ||
      typeof params.clientEventId !== "string" ||
      typeof params.baseVersion !== "number" ||
      typeof params.event !== "object" ||
      params.event === null
    ) {
      return rpcFail(call.id, "INVALID_PARAMS", "recordEvent requires { clientEventId, baseVersion, event }.");
    }

    const meta = await this.ctx.storage.get<SessionMeta>("meta");
    if (!meta) {
      return rpcFail(call.id, "SESSION_NOT_FOUND", "No session has been established yet.");
    }

    const clientEventId = params.clientEventId;
    const existing = await this.ctx.storage.get<AcceptedEventRecord>(`event:${clientEventId}`);
    const eventType = (params.event as Record<string, unknown>).eventType;

    const decision = evaluateRecordEvent({
      meta,
      existing,
      clientEventId,
      baseVersion: params.baseVersion,
      eventType,
      actorUserId: attachment.userId,
      now: Date.now(),
    });

    switch (decision.outcome) {
      case "session_ended":
        return rpcFail(call.id, "SESSION_ENDED", "This live session has ended.");
      case "invalid":
        return rpcFail(call.id, "EVENT_INVALID", "event.eventType is required.");
      case "stale_state":
        return rpcFail(call.id, "STALE_STATE", "This action requires the current version.", {
          currentVersion: decision.currentVersion,
        });
      case "duplicate": {
        const result: RecordEventResult = {
          version: decision.existing.version,
          persistenceStatus: decision.existing.persistenceStatus === "persisted" ? "persisted" : "pending",
        };
        return rpcOk(call.id, result);
      }
      case "accepted": {
        await this.putAcceptedEvent(decision.record);
        await this.ctx.storage.put("meta", { ...meta, version: decision.record.version } satisfies SessionMeta);

        const eventFields = params.event as Record<string, unknown>;
        const persistRequest: InternalPersistEventRequest = {
          matchId: meta.matchId,
          sessionId: meta.sessionId,
          organisationId: meta.organisationId,
          userId: attachment.userId,
          clientEventId: decision.record.clientEventId,
          eventType: String(eventType),
          period:
            typeof eventFields.period === "string"
              ? (eventFields.period as InternalPersistEventRequest["period"])
              : undefined,
          matchSeconds: typeof eventFields.matchSeconds === "number" ? eventFields.matchSeconds : undefined,
          playerId: typeof eventFields.playerId === "string" ? eventFields.playerId : undefined,
          secondaryPlayerId:
            typeof eventFields.secondaryPlayerId === "string" ? eventFields.secondaryPlayerId : undefined,
          payload:
            typeof eventFields.payload === "object" && eventFields.payload !== null
              ? (eventFields.payload as Record<string, unknown>)
              : undefined,
          correctionType: typeof eventFields.correctionType === "string" ? eventFields.correctionType : undefined,
          correctsEventId: typeof eventFields.correctsEventId === "string" ? eventFields.correctsEventId : undefined,
          rpcId: call.id,
        };

        // Placeholder broadcast content, used only if persistence below fails or throws —
        // Stage 3's original unconditional broadcast, kept as the fallback shape.
        let canonicalEvent: CanonicalLiveEvent = {
          id: decision.record.clientEventId,
          clientEventId: decision.record.clientEventId,
          eventType: String(eventType),
          createdAt: new Date(decision.record.acceptedAt).toISOString(),
        };
        let persistenceStatus: RecordEventResult["persistenceStatus"] = "pending";

        try {
          canonicalEvent = await persistEvent({
            baseUrl: this.env.MATCHBOARD_API_BASE_URL,
            secret: this.env.LIVE_MATCH_INTERNAL_SECRET,
            body: persistRequest,
          });
          persistenceStatus = "persisted";
          await this.markEventPersisted(decision.record.clientEventId, canonicalEvent.id);
        } catch (error) {
          // Stage 6 scope: retry via Durable Object alarms/outbox. For now this leaves
          // persistenceStatus "pending" in storage exactly as putAcceptedEvent already set it
          // — no regression, no crash, no event loss (the event remains durably recorded in
          // this object regardless; only *canonical* persistence to Neon failed here). SPEC.md
          // §32: never log the request body/signature/secret — only enough to diagnose which
          // event failed and why.
          const reason = error instanceof PersistEventError ? `HTTP ${error.status}` : "network error";
          console.error(
            `[MatchSessionObject] canonical persistence failed for clientEventId=${decision.record.clientEventId}: ${reason}`,
          );
        }

        this.broadcastToOthers(attachment.connectionId, "applyEvent", {
          version: decision.record.version,
          event: canonicalEvent,
        } satisfies ApplyEventCallback);

        if (persistenceStatus === "persisted") {
          this.broadcastToAll("eventPersistenceChanged", {
            clientEventId: decision.record.clientEventId,
            persistenceStatus: "persisted",
          } satisfies PersistenceChangedCallback);
        }

        const result: RecordEventResult = { version: decision.record.version, persistenceStatus };
        return rpcOk(call.id, result);
      }
    }
  }

  private async handleSyncPending(call: RpcCall): Promise<RpcResult> {
    const params = call.params as Partial<SyncPendingCommand> | undefined;
    if (!params || !Array.isArray(params.clientEventIds)) {
      return rpcFail(call.id, "INVALID_PARAMS", "syncPending requires { clientEventIds }.");
    }

    const accepted = await this.listAcceptedEvents();
    const acceptedMap = new Map(accepted.map((event) => [event.clientEventId, event]));
    const result: SyncPendingResult = { accepted: evaluateSyncPending(params.clientEventIds, acceptedMap) };
    return rpcOk(call.id, result);
  }

  private async handleEndSession(attachment: ConnectionAttachment, call: RpcCall): Promise<RpcResult> {
    if (!hasReportCapability(attachment.capabilities)) {
      return rpcFail(call.id, "FORBIDDEN", "This connection is view-only and cannot end the session.");
    }

    const params = call.params as Partial<EndSessionCommand> | undefined;
    if (!params || typeof params.baseVersion !== "number") {
      return rpcFail(call.id, "INVALID_PARAMS", "endSession requires { baseVersion }.");
    }

    const meta = await this.ctx.storage.get<SessionMeta>("meta");
    if (!meta) {
      return rpcFail(call.id, "SESSION_NOT_FOUND", "No session has been established yet.");
    }

    const accepted = await this.listAcceptedEvents();
    const pendingCount = accepted.filter((event) => event.persistenceStatus === "pending").length;

    const decision = evaluateEndSession({ meta, baseVersion: params.baseVersion, pendingCount });

    switch (decision.outcome) {
      case "already_ended":
        return rpcFail(call.id, "SESSION_ENDED", "This live session has already ended.");
      case "stale_state":
        return rpcFail(call.id, "STALE_STATE", "This action requires the current version.", {
          currentVersion: decision.currentVersion,
        });
      case "pending_persistence":
        return rpcFail(
          call.id,
          "PERSISTENCE_UNAVAILABLE",
          `${decision.pendingCount} event(s) have not reached canonical persistence yet; cannot end session.`,
          { retryable: true },
        );
      case "ended": {
        const nextMeta: SessionMeta = { ...meta, endedAt: Date.now() };
        await this.ctx.storage.put("meta", nextMeta);
        this.broadcastToAll("sessionEnded", { version: nextMeta.version } satisfies SessionEndedCallback);
        const result: EndSessionResult = { ended: true };
        return rpcOk(call.id, result);
      }
    }
  }

  // -------------------------------------------------------------------------------------
  // Storage helpers
  // -------------------------------------------------------------------------------------

  private async putAcceptedEvent(record: AcceptedEventRecord): Promise<void> {
    await this.ctx.storage.put(`event:${record.clientEventId}`, record);
    const ids = new Set((await this.ctx.storage.get<string[]>("eventIds")) ?? []);
    ids.add(record.clientEventId);
    await this.ctx.storage.put("eventIds", Array.from(ids));
  }

  private async markEventPersisted(clientEventId: string, canonicalEventId: string): Promise<void> {
    const record = await this.ctx.storage.get<AcceptedEventRecord>(`event:${clientEventId}`);
    if (!record) return;
    await this.ctx.storage.put(`event:${clientEventId}`, {
      ...record,
      persistenceStatus: "persisted",
      canonicalEventId,
    } satisfies AcceptedEventRecord);
  }

  private async listAcceptedEvents(): Promise<AcceptedEventRecord[]> {
    const ids = (await this.ctx.storage.get<string[]>("eventIds")) ?? [];
    if (ids.length === 0) return [];
    const map = await this.ctx.storage.get<AcceptedEventRecord>(ids.map((id) => `event:${id}`));
    return Array.from(map.values());
  }

  private async clearAcceptedEvents(): Promise<void> {
    const ids = (await this.ctx.storage.get<string[]>("eventIds")) ?? [];
    if (ids.length > 0) {
      await this.ctx.storage.delete(ids.map((id) => `event:${id}`));
    }
    await this.ctx.storage.delete("eventIds");
  }

  // -------------------------------------------------------------------------------------
  // Presence / broadcast (SPEC.md §16, §26 — hibernation-safe: derived from
  // `ctx.getWebSockets()`/attachments on demand, never from an in-memory Map/Set)
  // -------------------------------------------------------------------------------------

  private countAuthenticatedConnections(): number {
    return this.ctx.getWebSockets().filter((ws) => {
      const attachment = ws.deserializeAttachment() as ConnectionAttachment | null;
      return attachment?.authenticated === true;
    }).length;
  }

  private async broadcastPresence(): Promise<void> {
    const meta = await this.ctx.storage.get<SessionMeta>("meta");
    if (!meta || meta.endedAt !== null) return;
    const payload: PresenceChangedCallback = { connectedCount: this.countAuthenticatedConnections() };
    this.broadcastToAll("presenceChanged", payload);
  }

  private broadcastToAll(method: ClientMethod, params: unknown): void {
    const call = buildClientCall(method, params);
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as ConnectionAttachment | null;
      if (attachment?.authenticated) {
        ws.send(JSON.stringify(call));
      }
    }
  }

  private broadcastToOthers(excludeConnectionId: string, method: ClientMethod, params: unknown): void {
    const call = buildClientCall(method, params);
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as ConnectionAttachment | null;
      if (attachment?.authenticated && attachment.connectionId !== excludeConnectionId) {
        ws.send(JSON.stringify(call));
      }
    }
  }
}

function extractIdIfPresent(raw: string): string | null {
  try {
    const obj = JSON.parse(raw) as { id?: unknown };
    return typeof obj?.id === "string" ? obj.id : null;
  } catch {
    return null;
  }
}
