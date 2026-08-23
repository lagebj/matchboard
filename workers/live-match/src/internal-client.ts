/**
 * Worker-side client for the internal signed persistence API (SPEC.md §17-18, Stage 4).
 * Pure request construction is exported separately from the actual `fetch` call so the
 * signing/header logic is unit-testable without a network stub — `match-session-object.ts` is
 * the only caller of `persistEvent`/`getSnapshot`.
 */

import { signInternalRequest } from "../../../src/lib/live-match/realtime/internal-signature";
import type {
  InternalPersistEventRequest,
  InternalPersistEventResponse,
  InternalSnapshotResponse,
} from "../../../src/lib/live-match/realtime/realtime-messages";

export interface SignedRequestInit {
  url: string;
  method: "GET" | "POST";
  rawBody: string;
  headers: Record<string, string>;
}

/** Builds the exact request the internal endpoint expects — headers per SPEC.md §18, body
 * unmodified from what the caller supplied. `timestamp`/`requestId` are caller-supplied (not
 * generated internally) so tests can assert on exact values instead of freezing global clocks. */
export async function buildSignedRequest(params: {
  url: string;
  method: "GET" | "POST";
  rawBody: string;
  secret: string;
  timestamp: number;
  requestId: string;
}): Promise<SignedRequestInit> {
  const signature = await signInternalRequest({
    timestamp: params.timestamp,
    rawBody: params.rawBody,
    secret: params.secret,
  });

  return {
    url: params.url,
    method: params.method,
    rawBody: params.rawBody,
    headers: {
      "content-type": "application/json",
      "x-matchboard-timestamp": String(params.timestamp),
      "x-matchboard-request-id": params.requestId,
      "x-matchboard-signature": signature,
    },
  };
}

export class PersistEventError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "PersistEventError";
  }
}

export async function persistEvent(params: {
  baseUrl: string;
  secret: string;
  body: InternalPersistEventRequest;
}): Promise<InternalPersistEventResponse> {
  const rawBody = JSON.stringify(params.body);
  const signed = await buildSignedRequest({
    url: `${params.baseUrl}/api/internal/live-match/events`,
    method: "POST",
    rawBody,
    secret: params.secret,
    timestamp: Date.now(),
    requestId: crypto.randomUUID(),
  });

  const response = await fetch(signed.url, { method: signed.method, headers: signed.headers, body: signed.rawBody });

  if (!response.ok) {
    throw new PersistEventError(`Persistence request failed with status ${response.status}`, response.status);
  }

  return (await response.json()) as InternalPersistEventResponse;
}

export async function fetchSnapshot(params: {
  baseUrl: string;
  secret: string;
  matchId: string;
  sessionId: string;
}): Promise<InternalSnapshotResponse> {
  const url = new URL(`${params.baseUrl}/api/internal/live-match/snapshot`);
  url.searchParams.set("matchId", params.matchId);
  url.searchParams.set("sessionId", params.sessionId);

  // Nothing meaningful to sign over for a GET with no body — sign the empty string, keeping
  // the same canonical-input shape (`<timestamp>.<rawBody>`) as the POST path rather than a
  // special-cased scheme, per SPEC.md §18's single canonical signature input.
  const signed = await buildSignedRequest({
    url: url.toString(),
    method: "GET",
    rawBody: "",
    secret: params.secret,
    timestamp: Date.now(),
    requestId: crypto.randomUUID(),
  });

  const response = await fetch(signed.url, { method: signed.method, headers: signed.headers });

  if (!response.ok) {
    throw new PersistEventError(`Snapshot request failed with status ${response.status}`, response.status);
  }

  return (await response.json()) as InternalSnapshotResponse;
}
