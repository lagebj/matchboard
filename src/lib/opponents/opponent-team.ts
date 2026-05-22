const MAX_DISPLAY_NAME_LENGTH = 120;

export function normalizeOpponentName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

export function cleanOpponentDisplayName(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (cleaned.length === 0) {
    throw new Error("Opponent team name cannot be empty");
  }
  if (cleaned.length > MAX_DISPLAY_NAME_LENGTH) {
    throw new Error(`Opponent team name must be ${MAX_DISPLAY_NAME_LENGTH} characters or fewer`);
  }
  return cleaned;
}

export function validateOpponentTeamInput(input: unknown): { displayName: string; normalizedName: string } {
  if (typeof input !== "string") {
    throw new Error("Opponent team name is required");
  }
  const displayName = cleanOpponentDisplayName(input);
  const normalizedName = normalizeOpponentName(input);
  if (normalizedName.length === 0) {
    throw new Error("Opponent team name cannot be empty");
  }
  return { displayName, normalizedName };
}