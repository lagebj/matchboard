/**
 * Realtime RPC protocol envelope (live-match-realtime-programme Stage 1, SPEC.md §4–§6,
 * §30–§31). This module defines only the transport envelope shared by every realtime
 * message — method-specific payload shapes are validated separately per method, never here,
 * matching SPEC.md §4/§35's explicit ban on dispatching against an arbitrary method name.
 *
 * Business payload types (MatchSessionSnapshot, CanonicalLiveEvent, command/callback
 * inputs) live in `realtime-messages.ts`. Full field-level detail for the browser↔session
 * command/callback payloads is filled in as later stages actually wire them to real data —
 * SPEC.md itself only fully specifies MatchSessionSnapshot/ClockAnchor/the RPC envelope at
 * this level of detail; the rest are named interfaces (SPEC.md §5) without exhaustive field
 * lists. Do not invent precision SPEC.md doesn't provide.
 */

export const PROTOCOL_VERSION = 1 as const;

/** SPEC.md §4 — application-level maximum payload size. */
export const MAX_MESSAGE_BYTES = 64 * 1024;

export interface RpcCall {
  protocol: typeof PROTOCOL_VERSION;
  kind: "call";
  id: string;
  method: string;
  params: unknown;
}

export interface RpcSuccess {
  protocol: typeof PROTOCOL_VERSION;
  kind: "result";
  id: string;
  ok: true;
  result: unknown;
}

export interface RpcErrorDetail {
  code: RpcErrorCode;
  message: string;
  retryable?: boolean;
  currentVersion?: number;
}

export interface RpcFailure {
  protocol: typeof PROTOCOL_VERSION;
  kind: "result";
  id: string;
  ok: false;
  error: RpcErrorDetail;
}

export type RpcResult = RpcSuccess | RpcFailure;

export type RpcMessage = RpcCall | RpcResult;

/** SPEC.md §30 — the full stable error code set. UI logic must never parse error messages. */
export const RPC_ERROR_CODES = [
  "AUTH_REQUIRED",
  "AUTH_INVALID",
  "AUTH_EXPIRED",
  "FORBIDDEN",

  "PROTOCOL_UNSUPPORTED",
  "INVALID_MESSAGE",
  "METHOD_NOT_FOUND",
  "INVALID_PARAMS",
  "MESSAGE_TOO_LARGE",

  "SESSION_NOT_FOUND",
  "SESSION_ENDED",
  "SESSION_MISMATCH",

  "STALE_STATE",
  "EVENT_INVALID",
  "EVENT_ALREADY_EXISTS",

  "PERSISTENCE_UNAVAILABLE",
  "PERSISTENCE_FAILED",

  "INTERNAL_ERROR",
] as const;

export type RpcErrorCode = (typeof RPC_ERROR_CODES)[number];

export function isRpcErrorCode(value: unknown): value is RpcErrorCode {
  return typeof value === "string" && (RPC_ERROR_CODES as readonly string[]).includes(value);
}

/**
 * SPEC.md §5.1 — methods the browser may call on the MatchSession actor. This is the
 * explicit allowlist SPEC.md §4/§35 require instead of arbitrary method dispatch.
 */
export const SESSION_METHODS = [
  "authenticate",
  "getSnapshot",
  "recordEvent",
  "syncPending",
  "endSession",
] as const;

export type SessionMethod = (typeof SESSION_METHODS)[number];

export function isSessionMethod(value: string): value is SessionMethod {
  return (SESSION_METHODS as readonly string[]).includes(value);
}

/**
 * SPEC.md §5.2 — callback methods the MatchSession actor may invoke on a connected browser.
 */
export const CLIENT_METHODS = [
  "applySnapshot",
  "applyEvent",
  "eventPersistenceChanged",
  "presenceChanged",
  "sessionEnded",
  "forceResync",
] as const;

export type ClientMethod = (typeof CLIENT_METHODS)[number];

export function isClientMethod(value: string): value is ClientMethod {
  return (CLIENT_METHODS as readonly string[]).includes(value);
}

/** SPEC.md §12 — `authenticate` is the only method a connection may call before it has
 * successfully authenticated; every other pre-auth RPC must close the connection. */
export const PRE_AUTH_ALLOWED_METHOD: SessionMethod = "authenticate";
