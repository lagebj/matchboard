import { auth } from "@/auth";
import { AppError } from "@/lib/security/errors";
import { logAuthFailure } from "@/lib/security/audit-log";

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