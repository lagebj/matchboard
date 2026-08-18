import { auth } from "@/auth";
import { AppError } from "@/lib/security/errors";
import { logAuthFailure } from "@/lib/security/audit-log";
import { isTest } from "@/lib/env";

export class AuthenticationError extends AppError {
  constructor(message = "Authentication required") {
    super("UNAUTHORIZED", 401, message);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "Access denied") {
    super("FORBIDDEN", 403, message);
    this.name = "AuthorizationError";
  }
}

export async function getCurrentCoach() {
  if (isTest() && process.env.BYPASS_AUTH === "true") {
    // BYPASS_AUTH is double-gated: it only activates when MATCHBOARD_ENV=test AND BYPASS_AUTH=true.
    // This is a test-only mechanism. It must never be active in production.
    // validateEnv() enforces that BYPASS_AUTH=true is not set in production.
    return {
      id: "test-coach",
      email: "test@example.com",
      name: "Test Coach",
    };
  }
  const session = await auth();
  if (!session?.user?.email) return null;
  return session.user;
}

export async function requireCoachAccess() {
  const coach = await getCurrentCoach();
  if (!coach) {
    logAuthFailure("unknown", "no_session");
    throw new AuthenticationError("Coach access required");
  }
  return coach;
}