import "server-only";
import type { ProviderErrorCode } from "@/lib/ai/providers/provider-adapter";

/**
 * Shared outbound-request guards for every provider adapter (07_EXECUTION_PIPELINE.md "Provider
 * call requirements"): never follow a redirect on a request carrying credentials, use an
 * explicit timeout, and cap how much response body an adapter will ever read into memory.
 */

export const PROVIDER_REQUEST_TIMEOUT_MS = 20_000;
export const MAX_PROVIDER_RESPONSE_BYTES = 1_000_000;

export type GuardedFetchResult = { ok: true; response: Response } | { ok: false; errorCode: ProviderErrorCode };

export async function guardedProviderFetch(url: string, init: RequestInit): Promise<GuardedFetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...init, redirect: "manual", signal: controller.signal });
    if (response.type === "opaqueredirect") {
      return { ok: false, errorCode: "PROVIDER_UNAVAILABLE" };
    }
    return { ok: true, response };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, errorCode: "PROVIDER_TIMEOUT" };
    }
    return { ok: false, errorCode: "PROVIDER_UNAVAILABLE" };
  } finally {
    clearTimeout(timeout);
  }
}

export type ReadJsonResult = { ok: true; body: unknown } | { ok: false };

/** Reads the response body as text, enforcing a size cap, then parses it as JSON. Never throws —
 * a body over the cap or invalid JSON both come back as `{ ok: false }`. */
export async function readLimitedJsonBody(response: Response): Promise<ReadJsonResult> {
  let text: string;
  try {
    text = await response.text();
  } catch {
    return { ok: false };
  }

  if (text.length > MAX_PROVIDER_RESPONSE_BYTES) {
    return { ok: false };
  }

  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/** Maps an HTTP status to a normalized provider error code. Only 401 maps to
 * `PROVIDER_AUTH_FAILED` — every transient class (429, 5xx) maps elsewhere, so a rate limit or
 * an outage can never be misreported as a bad credential. */
export function classifyProviderHttpStatus(status: number): ProviderErrorCode {
  if (status === 401) return "PROVIDER_AUTH_FAILED";
  if (status === 403) return "PROVIDER_ACCESS_DENIED";
  if (status === 429) return "PROVIDER_RATE_LIMITED";
  if (status >= 500) return "PROVIDER_UNAVAILABLE";
  return "PROVIDER_RESPONSE_INVALID";
}
