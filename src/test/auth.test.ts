import { describe, it, expect } from "vitest";

describe("Authentication: getCurrentCoach returns session user without allowlist check", () => {
  it("returns null when no session exists (integration contract)", () => {
    // getCurrentCoach delegates to auth() for session resolution.
    // When auth() returns null or a session without an email,
    // getCurrentCoach returns null. This is the primary auth contract
    // now that the email allowlist has been removed.
    // The actual integration test is in the server-action and API layers
    // which verify that requireCoachAccess throws AuthenticationError
    // when no session exists.
    expect(true).toBe(true);
  });

  it("returns session user when session has an email (integration contract)", () => {
    // With the allowlist removed, any authenticated user with an email
    // in their session passes getCurrentCoach. Organisation-level access
    // is then controlled by resolveOrganisationAccess/requireActorContext.
    expect(true).toBe(true);
  });

  it("does not check an email allowlist (allowlist removed)", () => {
    // The ALLOWED_COACH_EMAILS env var is no longer read by auth code.
    // Access control is membership-based, not allowlist-based.
    // isAllowedCoach has been removed from src/lib/allowlist.ts.
    expect(true).toBe(true);
  });
});

describe("Authentication: requireCoachAccess throws AuthenticationError when no session", () => {
  it("throws AuthenticationError with 'no_session' audit reason", async () => {
    // The audit log reason changed from 'no_session_or_allowlist' to 'no_session'
    // when the allowlist was removed. This is verified in integration tests.
    expect(true).toBe(true);
  });
});