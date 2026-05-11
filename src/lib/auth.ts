import { auth } from "@/auth";
import { isAllowedCoach } from "@/lib/allowlist";

export { isAllowedCoach };

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
    throw new Error("Unauthorized: coach access required");
  }
  return coach;
}