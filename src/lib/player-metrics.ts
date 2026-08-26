import {
  getPlayerOverallRating,
  type RatingAttributeKey,
} from "@/lib/ratings/player-rating";

type PlayerAttributeRecord = Partial<Record<RatingAttributeKey, number | null>>;

type PlayerNameRecord = {
  firstName: string;
  lastName: string | null;
};

type PlayerPositionRecord = {
  primaryPosition: string;
  secondaryPosition: string | null;
  tertiaryPosition: string | null;
};

type AvailabilityStatusValue = "AVAILABLE" | "UNAVAILABLE" | "INJURED" | "SICK" | "AWAY" | "TENTATIVE" | "UNKNOWN";
type FootPreferenceValue = "LEFT" | "RIGHT";
type SecondaryFootValue = "LEFT" | "RIGHT" | "WEAK";
type BestSideValue = "LEFT" | "CENTER" | "RIGHT";

const technicalAttributeKeys: readonly RatingAttributeKey[] = [
  "ballControl",
  "passing",
  "firstTouch",
  "oneVOneAttacking",
];

const tacticalAttributeKeys: readonly RatingAttributeKey[] = [
  "positioning",
  "oneVOneDefending",
  "decisionMaking",
];

const mentalAttributeKeys: readonly RatingAttributeKey[] = [
  "effort",
  "teamplay",
  "concentration",
];

const physicalAttributeKeys: readonly RatingAttributeKey[] = ["speed", "strength"];

function averageForKeys(player: PlayerAttributeRecord, keys: readonly RatingAttributeKey[]): number | null {
  const values = keys
    .map((key) => player[key])
    .filter((v): v is number => v != null && v >= 1 && v <= 10);

  if (values.length === 0) return null;

  const total = values.reduce((sum, v) => sum + v, 0);
  return Math.round((total / values.length) * 10) / 10;
}

export function getPlayerAttributeAverages(player: PlayerAttributeRecord) {
  return {
    technical: averageForKeys(player, technicalAttributeKeys),
    tactical: averageForKeys(player, tacticalAttributeKeys),
    mental: averageForKeys(player, mentalAttributeKeys),
    physical: averageForKeys(player, physicalAttributeKeys),
    overall: getPlayerOverallRating(player).value,
  };
}

export function getOverallStarRating(overallRating: number | null): number {
  if (overallRating == null || !Number.isFinite(overallRating)) {
    return 0;
  }

  return Math.max(0, Math.min(5, Math.round(overallRating)));
}

export function formatAvailabilityStatus(status: AvailabilityStatusValue): string {
  switch (status) {
    case "AVAILABLE":
      return "Available";
    case "UNAVAILABLE":
      return "Unavailable";
    case "INJURED":
      return "Injured";
    case "SICK":
      return "Sick";
    case "AWAY":
      return "Away";
    case "TENTATIVE":
      return "Tentative";
    case "UNKNOWN":
      return "Unknown";
  }
}

export function formatPreferredFoot(value: FootPreferenceValue): string {
  return value === "LEFT" ? "Left" : "Right";
}

export function formatSecondaryFoot(value: SecondaryFootValue): string {
  switch (value) {
    case "LEFT":
      return "Left";
    case "RIGHT":
      return "Right";
    case "WEAK":
      return "Weak";
  }
}

export function formatBestSide(value: BestSideValue): string {
  switch (value) {
    case "LEFT":
      return "Left";
    case "CENTER":
      return "Center";
    case "RIGHT":
      return "Right";
  }
}

export function formatPlayerName(player: PlayerNameRecord): string {
  return player.lastName ? `${player.firstName} ${player.lastName}` : player.firstName;
}

export function getPlayerPositionSummary(
  player: PlayerPositionRecord,
): string {
  return [player.primaryPosition, player.secondaryPosition, player.tertiaryPosition]
    .filter(Boolean)
    .join(" / ");
}