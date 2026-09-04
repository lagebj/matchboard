/**
 * Realtime connection ticket signing/verification (SPEC.md §11–§12). Mirrors the structural
 * pattern already established by `src/lib/machine-principal/machine-token.ts` (jose
 * `SignJWT`/`jwtVerify`, HS256, short-lived, `jti`) — SPEC.md §35 explicitly says to inspect
 * that implementation for reusable primitives rather than invent a new signing convention,
 * while using a dedicated secret and dedicated, narrower claims (no organisation-wide or
 * global privilege — a ticket is scoped to exactly one match/session).
 *
 * Deliberately takes the signing/verification secret as a parameter rather than reading
 * `process.env` itself (contrast `getAuthSecret()`'s style in `machine-token.ts`) — this
 * module is shared application protocol code (SPEC.md §14) that Stage 3's Cloudflare Worker
 * will also need for verification, and Workers do not have `process.env`. Each runtime
 * supplies its own secret lookup (`getLiveMatchRealtimeSecret()` from `src/lib/env.ts` on
 * the Next.js side; a Worker `env` binding on the Cloudflare side, added in Stage 3).
 */

import { SignJWT, jwtVerify } from "jose";
import type { LiveMatchRealtimeTicket } from "./realtime-messages";

const ALG = "HS256";
const TICKET_TYPE = "live-match-realtime" as const;

/** SPEC.md §11: "approximately 60 to 120 seconds". */
export const REALTIME_TICKET_MIN_TTL_SECONDS = 60;
export const REALTIME_TICKET_MAX_TTL_SECONDS = 120;
export const REALTIME_TICKET_DEFAULT_TTL_SECONDS = 90;

export interface SignRealtimeTicketInput {
  userId: string;
  organisationId: string;
  matchId: string;
  sessionId: string;
  capabilities: string[];
  ttlSeconds?: number;
  /** See `LiveMatchRealtimeTicket.expectedEndAt`'s doc comment (`realtime-messages.ts`). */
  expectedEndAt?: number | null;
}

function encodeSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signRealtimeTicket(input: SignRealtimeTicketInput, secret: string): Promise<string> {
  const ttl = input.ttlSeconds ?? REALTIME_TICKET_DEFAULT_TTL_SECONDS;
  if (ttl < REALTIME_TICKET_MIN_TTL_SECONDS || ttl > REALTIME_TICKET_MAX_TTL_SECONDS) {
    throw new Error(
      `Realtime ticket TTL must be between ${REALTIME_TICKET_MIN_TTL_SECONDS} and ${REALTIME_TICKET_MAX_TTL_SECONDS} seconds.`,
    );
  }

  const jti = crypto.randomUUID();

  return new SignJWT({
    type: TICKET_TYPE,
    userId: input.userId,
    organisationId: input.organisationId,
    matchId: input.matchId,
    sessionId: input.sessionId,
    capabilities: input.capabilities,
    expectedEndAt: input.expectedEndAt ?? null,
  })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .setJti(jti)
    .sign(encodeSecret(secret));
}

export async function verifyRealtimeTicket(token: string, secret: string): Promise<LiveMatchRealtimeTicket> {
  let payload: Awaited<ReturnType<typeof jwtVerify>>["payload"];
  try {
    ({ payload } = await jwtVerify(token, encodeSecret(secret), { algorithms: [ALG] }));
  } catch {
    throw new Error("Invalid or expired realtime ticket.");
  }

  if (payload.type !== TICKET_TYPE) {
    throw new Error("Invalid ticket: wrong type.");
  }
  for (const field of ["userId", "organisationId", "matchId", "sessionId"] as const) {
    if (!payload[field] || typeof payload[field] !== "string") {
      throw new Error(`Invalid ticket: missing ${field}.`);
    }
  }
  if (!Array.isArray(payload.capabilities)) {
    throw new Error("Invalid ticket: missing capabilities.");
  }

  return {
    type: TICKET_TYPE,
    jti: (payload.jti as string) ?? "",
    userId: payload.userId as string,
    organisationId: payload.organisationId as string,
    matchId: payload.matchId as string,
    sessionId: payload.sessionId as string,
    capabilities: payload.capabilities as string[],
    iat: payload.iat ?? 0,
    exp: payload.exp ?? 0,
    expectedEndAt: typeof payload.expectedEndAt === "number" ? payload.expectedEndAt : null,
  };
}
