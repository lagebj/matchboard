/**
 * RPC envelope construction helpers, shared by `match-session-object.ts`'s inbound-call
 * handling and outbound client-callback sending. Reuses Stage 1's envelope types/schemas
 * (SPEC.md §14) rather than redefining them for the Worker side.
 */

import {
  PROTOCOL_VERSION,
  type RpcCall,
  type RpcResult,
  type RpcErrorCode,
} from "../../../src/lib/live-match/realtime/protocol";

export function rpcOk(id: string, result: unknown): RpcResult {
  return { protocol: PROTOCOL_VERSION, kind: "result", id, ok: true, result };
}

export function rpcFail(
  id: string,
  code: RpcErrorCode,
  message: string,
  extra?: { retryable?: boolean; currentVersion?: number },
): RpcResult {
  return { protocol: PROTOCOL_VERSION, kind: "result", id, ok: false, error: { code, message, ...extra } };
}

let callCounter = 0;

/** Builds an outbound server→client RPC call (SPEC.md §5.2). `id` only needs to be unique
 * within one connection's in-flight calls, not globally — a per-object counter is sufficient
 * and avoids pulling in a UUID dependency purely for this. */
export function buildClientCall(method: string, params: unknown): RpcCall {
  callCounter += 1;
  return {
    protocol: PROTOCOL_VERSION,
    kind: "call",
    id: `srv-${Date.now()}-${callCounter}`,
    method,
    params,
  };
}
