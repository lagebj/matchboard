/**
 * Zod validation for the realtime RPC envelope (SPEC.md §4, §35). Every incoming message
 * must pass through `parseIncomingMessage` before any handling — never dispatch against an
 * arbitrary `message.method` property (SPEC.md's explicit ban on `target[message.method](...)`).
 *
 * This module validates the envelope only (protocol version, kind, id, method-is-known,
 * message size). It does not validate method-specific `params`/`result` payloads — those are
 * business-payload schemas each stage adds as it wires up the method they belong to.
 */

import { z } from "zod";
import {
  MAX_MESSAGE_BYTES,
  PROTOCOL_VERSION,
  RPC_ERROR_CODES,
  isSessionMethod,
  isClientMethod,
  type RpcCall,
  type RpcResult,
  type RpcErrorCode,
} from "./protocol";

const rpcErrorDetailSchema = z.object({
  code: z.enum(RPC_ERROR_CODES),
  message: z.string(),
  retryable: z.boolean().optional(),
  currentVersion: z.number().optional(),
});

const rpcCallSchema = z.object({
  // Deliberately z.number(), not z.literal(PROTOCOL_VERSION): a future/unsupported protocol
  // version must still parse far enough to produce the specific PROTOCOL_UNSUPPORTED error
  // below, rather than being rejected earlier as a generic INVALID_MESSAGE by the shape
  // check itself (SPEC.md §31 — the receiver must recognize an unsupported version, not
  // just fail opaquely).
  protocol: z.number(),
  kind: z.literal("call"),
  id: z.string().min(1),
  method: z.string().min(1),
  params: z.unknown(),
});

const rpcSuccessSchema = z.object({
  // Deliberately z.number(), not z.literal(PROTOCOL_VERSION): a future/unsupported protocol
  // version must still parse far enough to produce the specific PROTOCOL_UNSUPPORTED error
  // below, rather than being rejected earlier as a generic INVALID_MESSAGE by the shape
  // check itself (SPEC.md §31 — the receiver must recognize an unsupported version, not
  // just fail opaquely).
  protocol: z.number(),
  kind: z.literal("result"),
  id: z.string().min(1),
  ok: z.literal(true),
  result: z.unknown(),
});

const rpcFailureSchema = z.object({
  // Deliberately z.number(), not z.literal(PROTOCOL_VERSION): a future/unsupported protocol
  // version must still parse far enough to produce the specific PROTOCOL_UNSUPPORTED error
  // below, rather than being rejected earlier as a generic INVALID_MESSAGE by the shape
  // check itself (SPEC.md §31 — the receiver must recognize an unsupported version, not
  // just fail opaquely).
  protocol: z.number(),
  kind: z.literal("result"),
  id: z.string().min(1),
  ok: z.literal(false),
  error: rpcErrorDetailSchema,
});

const rpcResultSchema = z.union([rpcSuccessSchema, rpcFailureSchema]);

const rpcMessageSchema = z.union([rpcCallSchema, rpcResultSchema]);

export type ParsedIncomingMessage =
  | { ok: true; message: RpcCall | RpcResult }
  | { ok: false; code: RpcErrorCode; reason: string };

/**
 * Validates a raw incoming message (already JSON-parsed) against the envelope schema, the
 * protocol version, and — for calls — the method allowlist for the given direction. Returns
 * a structured failure rather than throwing, so callers never need a try/catch around
 * dispatch logic.
 */
export function parseIncomingMessage(
  raw: unknown,
  direction: "toSession" | "toClient",
): ParsedIncomingMessage {
  const shapeResult = rpcMessageSchema.safeParse(raw);
  if (!shapeResult.success) {
    return { ok: false, code: "INVALID_MESSAGE", reason: "Envelope does not match the RPC schema." };
  }

  const message = shapeResult.data;

  if (message.protocol !== PROTOCOL_VERSION) {
    return { ok: false, code: "PROTOCOL_UNSUPPORTED", reason: `Unsupported protocol version: ${message.protocol}` };
  }

  if (message.kind === "call") {
    const isKnown = direction === "toSession" ? isSessionMethod(message.method) : isClientMethod(message.method);
    if (!isKnown) {
      return { ok: false, code: "METHOD_NOT_FOUND", reason: `Unknown method: ${message.method}` };
    }
  }

  // Zod's field schema is `z.number()` (not `z.literal(PROTOCOL_VERSION)`, see above), so its
  // inferred type is `number`, not the literal `1` `RpcCall`/`RpcResult` declare. The runtime
  // check just above already proves `message.protocol === PROTOCOL_VERSION`; this cast
  // reflects that proof back into the type, it does not bypass it.
  return { ok: true, message: message as RpcCall | RpcResult };
}

/**
 * Enforces SPEC.md §4's application-level maximum message size before any parsing. Callers
 * should check this against the raw wire payload (e.g. `event.data` byte length), not the
 * parsed object, since a byte-size check on decoded JS objects understates true wire size.
 */
export function exceedsMaxMessageSize(rawByteLength: number): boolean {
  return rawByteLength > MAX_MESSAGE_BYTES;
}

/** Shared with both the browser and the Cloudflare Worker (SPEC.md §14) — `TextEncoder` is
 * available in both runtimes and in Node, unlike `Buffer`, which the Workers runtime does
 * not provide natively. */
function byteLengthUtf8(value: string): number {
  return new TextEncoder().encode(value).length;
}

/** Convenience: parse a raw JSON string message from a WebSocket, combining the size check
 * and the envelope validation into a single call. */
export function parseRawSocketMessage(
  raw: string,
  direction: "toSession" | "toClient",
): ParsedIncomingMessage {
  if (exceedsMaxMessageSize(byteLengthUtf8(raw))) {
    return { ok: false, code: "MESSAGE_TOO_LARGE", reason: "Message exceeds the 64 KiB application limit." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, code: "INVALID_MESSAGE", reason: "Message is not valid JSON." };
  }

  return parseIncomingMessage(parsed, direction);
}
