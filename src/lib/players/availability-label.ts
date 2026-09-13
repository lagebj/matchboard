/**
 * Shared `Player.currentAvailability`/`PlayerCurrentRoundAttentionRow.availability` label
 * formatting (Atlas Follow-up), reused by both the Players Overview production adapter and the
 * Player Detail production adapter rather than duplicated per caller.
 */
const AVAILABILITY_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  INJURED: "Injured",
  SICK: "Sick",
  AWAY: "Away",
  TENTATIVE: "Tentative",
  UNKNOWN: "Unknown",
};

export function availabilityLabel(status: string): string {
  return AVAILABILITY_LABELS[status] ?? status;
}
