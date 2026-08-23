import "server-only";

import { getLiveMatchInternalSecret } from "@/lib/env";
import { verifyInternalSignature } from "./internal-signature";

/**
 * Vercel-side verification of an inbound Worker->Vercel signed request (SPEC.md §18). Reads
 * the raw body *before* any JSON parsing — the signature is computed over the exact raw bytes,
 * not a re-serialized/normalized version of them (re-serializing could silently accept a
 * tampered body that happens to parse to the same object shape but differs byte-for-byte).
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

  const rawBody = await request.text();
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
