import { auth } from "@/auth";
import { isAllowedCoach } from "@/lib/allowlist";
import { AppError } from "@/lib/security/errors";
import { logAuthFailure } from "@/lib/security/audit-log";

export { isAllowedCoach };

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
  if (process.env.NODE_ENV === "test" && process.env.BYPASS_AUTH === "true") {
    return {
      id: "test-coach",
      email: process.env.ALLOWED_COACH_EMAILS?.split(",")[0]?.trim() ?? "test@example.com",
      name: "Test Coach",
    };
  }
  const session = await auth();
  if (!session?.user?.email) return null;
  if (!isAllowedCoach(session.user.email)) return null;
  return session.user;
}

export async function requireCoachAccess() {
  const coach = await getCurrentCoach();
  if (!coach) {
    logAuthFailure("unknown", "no_session_or_allowlist");
    throw new AuthenticationError("Coach access required");
  }
  return coach;
}