/**
 * Worker<->Vercel internal request signing (SPEC.md §18). Shared code — the Worker uses
 * `signInternalRequest` to sign persistence requests, Vercel uses `verifyInternalSignature`
 * to check them — so both sides compute the exact same HMAC over the exact same canonical
 * input. Deliberately built on Web Crypto's `crypto.subtle` rather than Node's `crypto`
 * module: `crypto.subtle` is available natively in both the Cloudflare Workers runtime and
 * Node >=22 (this repo's minimum, per `realtime-ticket.ts`'s own note on runtime portability),
 * whereas Node's `crypto` module (and its `timingSafeEqual`) does not exist in Workers.
 *
 * Never reuses `AUTH_SECRET` or `LIVE_MATCH_REALTIME_SECRET` — `LIVE_MATCH_INTERNAL_SECRET` is
 * a distinct secret for this one trust boundary (SPEC.md §18), sourced by each runtime's own
 * environment lookup (`getLiveMatchInternalSecret()` on Vercel; a Worker `env` binding on
 * Cloudflare) and passed in explicitly here rather than read from `process.env` directly,
 * mirroring `realtime-ticket.ts`'s existing convention for exactly the same reason (Workers
 * has no `process.env`).
 */

const ALGORITHM = { name: "HMAC", hash: "SHA-256" };

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), ALGORITHM, false, ["sign"]);
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** SPEC.md §18 — canonical signature input is `<timestamp>.<raw request body>`. `timestamp`
 * is the same value sent in the `x-matchboard-timestamp` header, as a Unix millisecond
 * integer — never re-derived from `Date.now()` at verification time. */
export async function signInternalRequest(params: {
  timestamp: number;
  rawBody: string;
  secret: string;
}): Promise<string> {
  const key = await importKey(params.secret);
  const data = new TextEncoder().encode(`${params.timestamp}.${params.rawBody}`);
  const signature = await crypto.subtle.sign(ALGORITHM, key, data);
  return toHex(signature);
}

/** Constant-time hex-string comparison. `crypto.subtle` has no built-in timingSafeEqual
 * (unlike Node's `crypto` module) — both inputs here are hex-encoded SHA-256 digests, always
 * the same fixed length (64 hex chars) when both are genuine, so the length short-circuit
 * below only ever leaks "this wasn't even a same-length digest," never which character of a
 * same-length comparison differed. */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export interface VerifyInternalSignatureParams {
  timestamp: number;
  rawBody: string;
  signature: string;
  secret: string;
  /** Caller-supplied "now" (ms) — never `Date.now()` computed inside this function, so callers
   * (and tests) control the clock explicitly. */
  now: number;
  /** SPEC.md §18: "reject timestamps outside a short tolerance such as 60 seconds." */
  toleranceMs?: number;
}

export type VerifyInternalSignatureResult =
  | { ok: true }
  | { ok: false; reason: "STALE_TIMESTAMP" | "INVALID_SIGNATURE" };

export async function verifyInternalSignature(
  params: VerifyInternalSignatureParams,
): Promise<VerifyInternalSignatureResult> {
  const tolerance = params.toleranceMs ?? 60_000;
  if (Math.abs(params.now - params.timestamp) > tolerance) {
    return { ok: false, reason: "STALE_TIMESTAMP" };
  }

  const expected = await signInternalRequest({
    timestamp: params.timestamp,
    rawBody: params.rawBody,
    secret: params.secret,
  });

  if (!timingSafeEqualHex(expected, params.signature)) {
    return { ok: false, reason: "INVALID_SIGNATURE" };
  }

  return { ok: true };
}
