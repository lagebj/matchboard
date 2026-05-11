export function isAllowedCoach(email: string): boolean {
  const allowed = process.env.ALLOWED_COACH_EMAILS;
  if (!allowed) return false;
  return allowed
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .includes(email.trim().toLowerCase());
}