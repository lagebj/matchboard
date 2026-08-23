import "server-only";

import { getLiveMatchInternalSecret } from "@/lib/env";
import { verifyInternalSignature } from "./internal-signature";

/**
 * Vercel-side verification of an inbound Worker->Vercel signed request (SPEC.md §18). For a
 * POST, reads the raw body *before* any JSON parsing — the signature is computed over the
 * exact raw bytes, not a re-serialized/normalized version of them (re-serializing could
 * silently accept a tampered body that happens to parse to the same object shape but differs
 * byte-for-byte).
 *
 * For a GET (the snapshot endpoint has no body), the query string is the signable content
 * instead — the URL's `search` (e.g. `?matchId=X&sessionId=Y`), never the empty string. A
 * fixed empty-string signature would be valid for *any* matchId/sessionId combination within
 * the timestamp tolerance window, since nothing would then bind the signature to which match's
 * data the request actually asks for — a captured valid signed GET could be replayed with
 * different query params to read a different match's snapshot. Signing the query string closes
 * that: the signature is only valid for the exact matchId/sessionId it was issued for.
 */
export type InternalRequestVerification =
  | { ok: true; rawBody: string; requestId: string }
  | { ok: false; status: number; error: string };

export async function verifyInternalRequest(request: Request): Promise<InternalRequestVerification> {
  const timestampHeader = request.headers.get("x-matchboard-timestamp");
  const requestId = request.headers.get("x-matchboard-request-id");
  const signature = request.headers.get("x-matchboard-signature");

  if (!timestampHeader || !requestId || !signature) {
    return { ok: false, status: 401, error: "Missing signature headers" };
  }

  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp)) {
    return { ok: false, status: 401, error: "Invalid timestamp header" };
  }

  const rawBody = request.method === "GET" ? new URL(request.url).search : await request.text();
  const secret = getLiveMatchInternalSecret();

  const result = await verifyInternalSignature({ timestamp, rawBody, signature, secret, now: Date.now() });

  if (!result.ok) {
    return {
      ok: false,
      status: 401,
      error: result.reason === "STALE_TIMESTAMP" ? "Timestamp outside tolerance" : "Invalid signature",
    };
  }

  return { ok: true, rawBody, requestId };
}
