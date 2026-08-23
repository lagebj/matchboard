import { describe, expect, it } from "vitest";
import { verifyRealtimeTicket, isOriginAllowed, isValidMatchIdShape, parseAllowedOrigins } from "../src/auth";
import { signRealtimeTicket } from "../../../src/lib/live-match/realtime/realtime-ticket";

const SECRET = "worker-test-secret-do-not-use-in-real-env";
const OTHER_SECRET = "a-completely-different-secret-value";

/**
 * `auth.ts` re-exports `verifyRealtimeTicket` from `src/lib/live-match/realtime/`, which
 * already has its own full test matrix (valid, expired, wrong type, tampered signature —
 * `src/lib/live-match/realtime/__tests__/realtime-ticket.test.ts`, Stage 2). Re-testing that
 * matrix here would duplicate coverage, not add any — this just proves the Worker-side
 * re-export wires to the same implementation.
 */
describe("verifyRealtimeTicket (Worker-side re-export)", () => {
  it("verifies a validly-signed ticket and returns its claims", async () => {
    const ticket = await signRealtimeTicket(
      { userId: "user-1", organisationId: "org-1", matchId: "match-1", sessionId: "session-1", capabilities: ["report"] },
      SECRET,
    );
    const claims = await verifyRealtimeTicket(ticket, SECRET);
    expect(claims).toMatchObject({
      type: "live-match-realtime",
      userId: "user-1",
      organisationId: "org-1",
      matchId: "match-1",
      sessionId: "session-1",
    });
  });

  it("rejects a ticket signed with a different secret", async () => {
    const ticket = await signRealtimeTicket(
      { userId: "user-1", organisationId: "org-1", matchId: "match-1", sessionId: "session-1", capabilities: ["report"] },
      SECRET,
    );
    await expect(verifyRealtimeTicket(ticket, OTHER_SECRET)).rejects.toThrow();
  });
});

describe("parseAllowedOrigins / isOriginAllowed", () => {
  it("parses a comma-separated list, trimming whitespace", () => {
    const allowed = parseAllowedOrigins(" https://app.matchboard.football , https://test.matchboard.football ");
    expect(allowed.has("https://app.matchboard.football")).toBe(true);
    expect(allowed.has("https://test.matchboard.football")).toBe(true);
    expect(allowed.size).toBe(2);
  });

  it("allows an exact match and rejects everything else", () => {
    const allowed = parseAllowedOrigins("https://app.matchboard.football");
    expect(isOriginAllowed("https://app.matchboard.football", allowed)).toBe(true);
    expect(isOriginAllowed("https://evil.example.com", allowed)).toBe(false);
    expect(isOriginAllowed(null, allowed)).toBe(false);
  });
});

describe("isValidMatchIdShape", () => {
  it("accepts opaque alphanumeric/dash/underscore ids", () => {
    expect(isValidMatchIdShape("clx1a2b3c4d5")).toBe(true);
    expect(isValidMatchIdShape("match_1-2")).toBe(true);
  });

  it("rejects empty, oversized, or path-breaking ids", () => {
    expect(isValidMatchIdShape("")).toBe(false);
    expect(isValidMatchIdShape("a".repeat(65))).toBe(false);
    expect(isValidMatchIdShape("../etc/passwd")).toBe(false);
    expect(isValidMatchIdShape("has space")).toBe(false);
  });
});
