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
 * "accepted" branch signs and sends the event to `POST /api/internal/live-match/events`
 * (`./internal-client.ts`) *within the same RPC call*, awaited before responding — deliberately
 * not fire-and-forget, since nothing here extends this Durable Object's execution past the
 * point `webSocketMessage` returns (no `waitUntil`-equivalent for an already-hibernatable
 * object), so an un-awaited persistence call could be interrupted before it completes. On
 * success, `persistenceStatus` becomes `"persisted"` and the real canonical event (from
 * Neon, via Vercel) replaces the placeholder broadcast.
 *
 * SPEC.md §21 (Stage 6, "persistence outbox"): on failure, the first synchronous attempt's
 * outcome is classified (`classifyPersistenceFailure`, `./state.ts`) into terminal (a 4xx —
 * this exact request will never succeed, whatever `LiveMatchDomainError` `recordEventForActor`
 * rejected with is still true tomorrow) or retryable (5xx, or no response at all — a
 * genuinely transient failure). Terminal failures are marked `"failed_terminal"` immediately
 * and clients are notified via `eventPersistenceChanged`; nothing is ever retried past that.
 * Retryable failures are left `"pending"` with a `nextRetryAt` (exponential backoff,
 * `computeBackoffDelayMs`), and a single Durable Object alarm is (re)scheduled for the
 * earliest `nextRetryAt` across every still-pending event (`nextAlarmTime`) — one alarm slot
 * per object, not one per event (Cloudflare Durable Objects only have one alarm slot; a
 * second `setAlarm` call replaces the first, so `alarm()` always sweeps every currently-due
 * event in one firing rather than assuming it fired for exactly one). The `alarm()` handler
 * is naturally idempotent (Cloudflare's own stated requirement, since alarms may be retried):
 * it only ever re-attempts events still in `"pending"` state, so a duplicate firing for
 * already-resolved events is a no-op, and `recordEventForActor`'s own `clientEventId` dedup
 * (Stage 4) means even a genuinely-duplicated persistence attempt can never create a second
 * canonical Neon row.
 *
 * SPEC.md §23 (Stage 6, "reconciliation"): `handleAuthenticate`'s `"initialize"` outcome (a
 * genuinely new session for this object, or the first authenticate this object has ever seen)
 * now calls the internal snapshot endpoint (`fetchSnapshot`) to discover canonical events that
 * reached Neon via the HTTP fallback path without ever going through this object — assigning
 * each one a new realtime version and idempotency mapping (`evaluateReconciliation`) before
 * the connection is considered attached. `handleGetSnapshot` (SPEC.md §25) now returns these
 * reconciled events (plus every event accepted directly), so a reconnecting client's snapshot
 * is genuinely complete rather than the Stage 3/4 placeholder empty array.
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
  classifyPersistenceFailure,
  computeBackoffDelayMs,
  selectDueRetries,
  nextAlarmTime,
  evaluateReconciliation,
  type SessionMeta,
  type AcceptedEventRecord,
} from "./state";
import { fetchSnapshot } from "./internal-client";
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
      await this.reconcileFromCanonicalSnapshot(decision.meta);
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

    // SPEC.md §25: a complete snapshot, not a partial replay window. `accepted` already
    // includes both directly-recorded events and anything Stage 6's reconciliation
    // (`handleAuthenticate` -> `reconcileFromCanonicalSnapshot`) discovered from the HTTP
    // fallback path — this object's own storage is the single source `getSnapshot` reads
    // from, so it never needs its own extra network round-trip per call.
    const events: CanonicalLiveEvent[] = accepted
      .slice()
      .sort((a, b) => a.version - b.version)
      .map((event) => ({
        id: event.canonicalEventId ?? event.clientEventId,
        clientEventId: event.clientEventId,
        eventType: event.eventType,
        createdAt: new Date(event.acceptedAt).toISOString(),
      }));

    const snapshot: MatchSessionSnapshot = {
      protocolVersion: 1,
      version: meta.version,
      session: {
        sessionId: meta.sessionId,
        matchId: meta.matchId,
        status: meta.endedAt === null ? "ACTIVE" : "ENDED",
      },
      clock: meta.clockAnchor,
      events,
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
    const eventFields = params.event as Record<string, unknown>;
    const eventType = eventFields.eventType;

    const decision = evaluateRecordEvent({
      meta,
      existing,
      clientEventId,
      baseVersion: params.baseVersion,
      eventType,
      eventFields,
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

        const persistRequest: InternalPersistEventRequest = {
          matchId: meta.matchId,
          sessionId: meta.sessionId,
          organisationId: meta.organisationId,
          userId: attachment.userId,
          clientEventId: decision.record.clientEventId,
          eventType: String(eventType),
          ...buildPersistEventFields(eventFields),
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
          // SPEC.md §21, Stage 6 — classify before deciding whether to ever try again.
          // Never log the request body/signature/secret (SPEC.md §32) — only enough
          // ids/status to diagnose which event failed and why.
          const status = error instanceof PersistEventError ? error.status : undefined;
          const classification = classifyPersistenceFailure(status);
          this.logStructured("error", "canonical persistence attempt failed", {
            clientEventId: decision.record.clientEventId,
            rpcId: call.id,
            errorCode: classification === "terminal" ? "PERSISTENCE_FAILED" : "PERSISTENCE_UNAVAILABLE",
            retryable: classification === "retryable",
          });

          if (classification === "terminal") {
            persistenceStatus = "failed_terminal";
            await this.markEventFailedTerminal(decision.record.clientEventId);
          } else {
            await this.scheduleRetry(decision.record.clientEventId);
          }
        }

        this.broadcastToOthers(attachment.connectionId, "applyEvent", {
          version: decision.record.version,
          event: canonicalEvent,
        } satisfies ApplyEventCallback);

        if (persistenceStatus === "persisted" || persistenceStatus === "failed_terminal") {
          this.broadcastToAll("eventPersistenceChanged", {
            clientEventId: decision.record.clientEventId,
            persistenceStatus,
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
      nextRetryAt: undefined,
    } satisfies AcceptedEventRecord);
  }

  /** SPEC.md §21 — a terminal domain failure. Stops retrying immediately: no `nextRetryAt`, so
   * this event is permanently excluded from `selectDueRetries`/`nextAlarmTime` from here on. */
  private async markEventFailedTerminal(clientEventId: string): Promise<void> {
    const record = await this.ctx.storage.get<AcceptedEventRecord>(`event:${clientEventId}`);
    if (!record) return;
    await this.ctx.storage.put(`event:${clientEventId}`, {
      ...record,
      persistenceStatus: "failed_terminal",
      nextRetryAt: undefined,
    } satisfies AcceptedEventRecord);
  }

  /** SPEC.md §21 — records a retryable failure's backoff schedule and (re)arms the object's
   * single alarm slot for the earliest currently-due retry across every pending event, not
   * just this one. */
  private async scheduleRetry(clientEventId: string): Promise<void> {
    const record = await this.ctx.storage.get<AcceptedEventRecord>(`event:${clientEventId}`);
    if (!record) return;
    const nextRetryAt = Date.now() + computeBackoffDelayMs(record.retryCount);
    await this.ctx.storage.put(`event:${clientEventId}`, {
      ...record,
      retryCount: record.retryCount + 1,
      nextRetryAt,
    } satisfies AcceptedEventRecord);
    await this.refreshAlarm();
  }

  /** (Re)computes the object's single alarm slot from current storage state — the earliest
   * `nextRetryAt` across every still-pending event, or clears the alarm entirely when nothing
   * is waiting (SPEC.md §21: "do not wake the object every second"). Cloudflare Durable
   * Objects have exactly one alarm slot per object; calling `setAlarm` again simply replaces
   * whatever was scheduled before, which is exactly what's wanted here — one slot serving
   * every pending event, not one per event. */
  private async refreshAlarm(): Promise<void> {
    const accepted = await this.listAcceptedEvents();
    const alarmTime = nextAlarmTime(accepted);
    if (alarmTime === null) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(alarmTime);
  }

  /**
   * SPEC.md §21 "Durable Object alarms to retry pending persistence." Sweeps every event
   * currently due for a retry (`selectDueRetries`) in one firing — not one alarm per event —
   * and re-arms the alarm afterward for whatever is still pending. Naturally idempotent: a
   * duplicate firing (Cloudflare's own documented "alarms may be retried") only ever touches
   * events still in `"pending"` state, so nothing here can double-persist or double-broadcast
   * an event that a previous firing (or the original synchronous attempt) already resolved.
   */
  async alarm(): Promise<void> {
    const meta = await this.ctx.storage.get<SessionMeta>("meta");
    if (!meta) return;

    const accepted = await this.listAcceptedEvents();
    const due = selectDueRetries(accepted, Date.now());

    for (const record of due) {
      try {
        const canonical = await persistEvent({
          baseUrl: this.env.MATCHBOARD_API_BASE_URL,
          secret: this.env.LIVE_MATCH_INTERNAL_SECRET,
          body: {
            matchId: meta.matchId,
            sessionId: meta.sessionId,
            organisationId: meta.organisationId,
            userId: record.actorUserId,
            clientEventId: record.clientEventId,
            eventType: record.eventType,
            ...buildPersistEventFields(record.eventFields ?? {}),
            rpcId: `alarm-retry-${record.clientEventId}`,
          },
        });
        await this.markEventPersisted(record.clientEventId, canonical.id);
        this.broadcastToAll("eventPersistenceChanged", {
          clientEventId: record.clientEventId,
          persistenceStatus: "persisted",
        } satisfies PersistenceChangedCallback);
      } catch (error) {
        const status = error instanceof PersistEventError ? error.status : undefined;
        const classification = classifyPersistenceFailure(status);
        this.logStructured("error", "alarm retry failed", {
          clientEventId: record.clientEventId,
          errorCode: classification === "terminal" ? "PERSISTENCE_FAILED" : "PERSISTENCE_UNAVAILABLE",
          retryable: classification === "retryable",
        });

        if (classification === "terminal") {
          await this.markEventFailedTerminal(record.clientEventId);
          this.broadcastToAll("eventPersistenceChanged", {
            clientEventId: record.clientEventId,
            persistenceStatus: "failed_terminal",
          } satisfies PersistenceChangedCallback);
        } else {
          await this.scheduleRetry(record.clientEventId);
        }
      }
    }

    // Every branch above (success, terminal, or a fresh retry schedule) may have changed which
    // event is now the next-soonest — recompute once at the end rather than per-event.
    await this.refreshAlarm();
  }

  /**
   * SPEC.md §23 — discover canonical events that reached Neon via the HTTP fallback path
   * without ever going through this object (a device that used HTTP while realtime was
   * unavailable, or simply the first-ever connection for a session that already has HTTP
   * history). Runs once per `"initialize"` outcome (a fresh object, or re-arming for a new
   * session after the previous one ended) — never on a plain reconnect/`"attach"` to an
   * already-initialized session, since that session's history was already reconciled the one
   * time it was initialized. A failure here (network hiccup reaching the internal endpoint)
   * must not block authentication — reconciliation is an enhancement, not a dependency,
   * exactly like realtime itself is additive to the existing HTTP-first model (ADR-0086).
   */
  private async reconcileFromCanonicalSnapshot(meta: SessionMeta): Promise<void> {
    let snapshot;
    try {
      snapshot = await fetchSnapshot({
        baseUrl: this.env.MATCHBOARD_API_BASE_URL,
        secret: this.env.LIVE_MATCH_INTERNAL_SECRET,
        matchId: meta.matchId,
        sessionId: meta.sessionId,
      });
    } catch (error) {
      this.logStructured("error", "reconciliation snapshot fetch failed", {
        matchId: meta.matchId,
        sessionId: meta.sessionId,
        errorCode: "PERSISTENCE_UNAVAILABLE",
      });
      void error;
      return;
    }

    const known = new Set((await this.ctx.storage.get<string[]>("eventIds")) ?? []);
    const result = evaluateReconciliation({
      currentVersion: meta.version,
      knownClientEventIds: known,
      canonicalEvents: snapshot.events,
    });

    if (result.newRecords.length === 0) return;

    for (const record of result.newRecords) {
      await this.putAcceptedEvent(record);
    }
    await this.ctx.storage.put("meta", { ...meta, version: result.finalVersion } satisfies SessionMeta);
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

  /**
   * SPEC.md §32 — structured fields only (matchId/sessionId/clientEventId/errorCode/etc.),
   * never the internal secret, an HMAC signature, or a full event payload/fair-play free
   * text. Cloudflare Workers have no `pino`; `console.error`/`console.log` with a JSON object
   * (not string interpolation) is what's actually queryable in `wrangler tail`/the dashboard.
   */
  private logStructured(level: "error" | "log", message: string, fields: Record<string, unknown>): void {
    const line = { message, ...fields };
    if (level === "error") {
      console.error(JSON.stringify(line));
    } else {
      console.log(JSON.stringify(line));
    }
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

/**
 * Narrows the browser's untyped `RecordEventCommand.event` payload (or a stored
 * `AcceptedEventRecord.eventFields`) down to `InternalPersistEventRequest`'s optional
 * fields. Shared by `handleRecordEvent`'s first synchronous persistence attempt and
 * `alarm()`'s retry sweep so both send the *identical* set of fields for the same event —
 * before this existed, the alarm-driven retry only ever sent `eventType`, silently dropping
 * `playerId`/`matchSeconds`/`payload`/etc. if the event's first attempt failed and only the
 * alarm ever succeeded (see this file's Stage 6 review notes / ADR-0086's History).
 */
function buildPersistEventFields(
  eventFields: Record<string, unknown>,
): Pick<
  InternalPersistEventRequest,
  "period" | "matchSeconds" | "playerId" | "secondaryPlayerId" | "payload" | "correctionType" | "correctsEventId"
> {
  return {
    period: typeof eventFields.period === "string" ? (eventFields.period as InternalPersistEventRequest["period"]) : undefined,
    matchSeconds: typeof eventFields.matchSeconds === "number" ? eventFields.matchSeconds : undefined,
    playerId: typeof eventFields.playerId === "string" ? eventFields.playerId : undefined,
    secondaryPlayerId: typeof eventFields.secondaryPlayerId === "string" ? eventFields.secondaryPlayerId : undefined,
    payload:
      typeof eventFields.payload === "object" && eventFields.payload !== null
        ? (eventFields.payload as Record<string, unknown>)
        : undefined,
    correctionType: typeof eventFields.correctionType === "string" ? eventFields.correctionType : undefined,
    correctsEventId: typeof eventFields.correctsEventId === "string" ? eventFields.correctsEventId : undefined,
  };
}
