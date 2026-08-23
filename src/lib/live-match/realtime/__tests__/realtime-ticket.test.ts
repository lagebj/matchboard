import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import {
  signRealtimeTicket,
  verifyRealtimeTicket,
  REALTIME_TICKET_MIN_TTL_SECONDS,
  REALTIME_TICKET_MAX_TTL_SECONDS,
} from "../realtime-ticket";

const SECRET = "test-realtime-secret-not-a-real-one";
const OTHER_SECRET = "a-different-secret-entirely";

const baseInput = {
  userId: "user-1",
  organisationId: "org-1",
  matchId: "match-1",
  sessionId: "session-1",
  capabilities: ["report"],
};

describe("signRealtimeTicket / verifyRealtimeTicket — valid ticket", () => {
  it("round-trips the exact claims that were signed", async () => {
    const token = await signRealtimeTicket(baseInput, SECRET);
    const verified = await verifyRealtimeTicket(token, SECRET);

    expect(verified.userId).toBe(baseInput.userId);
    expect(verified.organisationId).toBe(baseInput.organisationId);
    expect(verified.matchId).toBe(baseInput.matchId);
    expect(verified.sessionId).toBe(baseInput.sessionId);
    expect(verified.capabilities).toEqual(baseInput.capabilities);
    expect(verified.jti).toBeTruthy();
    expect(verified.type).toBe("live-match-realtime");
  });

  it("defaults to a TTL inside the SPEC.md §11 60-120s window", async () => {
    const token = await signRealtimeTicket(baseInput, SECRET);
    const verified = await verifyRealtimeTicket(token, SECRET);
    const ttl = verified.exp - verified.iat;
    expect(ttl).toBeGreaterThanOrEqual(REALTIME_TICKET_MIN_TTL_SECONDS);
    expect(ttl).toBeLessThanOrEqual(REALTIME_TICKET_MAX_TTL_SECONDS);
  });
});

describe("signRealtimeTicket — TTL bounds", () => {
  it("rejects a TTL below the minimum", async () => {
    await expect(signRealtimeTicket({ ...baseInput, ttlSeconds: 10 }, SECRET)).rejects.toThrow(/TTL must be between/);
  });

  it("rejects a TTL above the maximum", async () => {
    await expect(signRealtimeTicket({ ...baseInput, ttlSeconds: 999 }, SECRET)).rejects.toThrow(/TTL must be between/);
  });

  it("accepts a TTL exactly at each bound", async () => {
    await expect(signRealtimeTicket({ ...baseInput, ttlSeconds: REALTIME_TICKET_MIN_TTL_SECONDS }, SECRET)).resolves.toBeTruthy();
    await expect(signRealtimeTicket({ ...baseInput, ttlSeconds: REALTIME_TICKET_MAX_TTL_SECONDS }, SECRET)).resolves.toBeTruthy();
  });
});

describe("verifyRealtimeTicket — expired ticket", () => {
  it("rejects a ticket whose expiration has already passed", async () => {
    const expiredToken = await new SignJWT({
      type: "live-match-realtime",
      userId: baseInput.userId,
      organisationId: baseInput.organisationId,
      matchId: baseInput.matchId,
      sessionId: baseInput.sessionId,
      capabilities: baseInput.capabilities,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 100)
      .setJti(crypto.randomUUID())
      .sign(new TextEncoder().encode(SECRET));

    await expect(verifyRealtimeTicket(expiredToken, SECRET)).rejects.toThrow(/Invalid or expired/);
  });
});

describe("verifyRealtimeTicket — invalid signature", () => {
  it("rejects a ticket signed with a different secret", async () => {
    const token = await signRealtimeTicket(baseInput, SECRET);
    await expect(verifyRealtimeTicket(token, OTHER_SECRET)).rejects.toThrow(/Invalid or expired/);
  });

  it("rejects a structurally tampered token", async () => {
    const token = await signRealtimeTicket(baseInput, SECRET);
    const tampered = `${token.slice(0, -2)}xx`;
    await expect(verifyRealtimeTicket(tampered, SECRET)).rejects.toThrow(/Invalid or expired/);
  });
});

describe("verifyRealtimeTicket — wrong ticket type", () => {
  it("rejects a well-formed token of a different type", async () => {
    const wrongType = await new SignJWT({
      type: "some-other-token-type",
      userId: baseInput.userId,
      organisationId: baseInput.organisationId,
      matchId: baseInput.matchId,
      sessionId: baseInput.sessionId,
      capabilities: baseInput.capabilities,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("90s")
      .setJti(crypto.randomUUID())
      .sign(new TextEncoder().encode(SECRET));

    await expect(verifyRealtimeTicket(wrongType, SECRET)).rejects.toThrow(/wrong type/);
  });
});

describe("verifyRealtimeTicket — missing required claims", () => {
  it("rejects a token missing matchId", async () => {
    const missingField = await new SignJWT({
      type: "live-match-realtime",
      userId: baseInput.userId,
      organisationId: baseInput.organisationId,
      sessionId: baseInput.sessionId,
      capabilities: baseInput.capabilities,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("90s")
      .setJti(crypto.randomUUID())
      .sign(new TextEncoder().encode(SECRET));

    await expect(verifyRealtimeTicket(missingField, SECRET)).rejects.toThrow(/missing matchId/);
  });
});
