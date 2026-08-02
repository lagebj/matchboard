import {
  AvailabilityStatus,
  BestSide,
  FootPreference,
  GoalkeeperAbility,
  MatchType,
  MatchVenue,
  SecondaryFoot,
} from "@/generated/prisma/client";

export const preferredFootOptions = [
  { label: "Left", value: FootPreference.LEFT },
  { label: "Right", value: FootPreference.RIGHT },
] as const;

export const secondaryFootOptions = [
  { label: "Left", value: SecondaryFoot.LEFT },
  { label: "Right", value: SecondaryFoot.RIGHT },
  { label: "Weak", value: SecondaryFoot.WEAK },
] as const;

export const bestSideOptions = [
  { label: "Left", value: BestSide.LEFT },
  { label: "Center", value: BestSide.CENTER },
  { label: "Right", value: BestSide.RIGHT },
] as const;

export const availabilityOptions = [
  { label: "Available", value: AvailabilityStatus.AVAILABLE },
  { label: "Unavailable", value: AvailabilityStatus.UNAVAILABLE },
  { label: "Injured", value: AvailabilityStatus.INJURED },
  { label: "Sick", value: AvailabilityStatus.SICK },
  { label: "Away", value: AvailabilityStatus.AWAY },
  { label: "Tentative", value: AvailabilityStatus.TENTATIVE },
  { label: "Unknown", value: AvailabilityStatus.UNKNOWN },
] as const;

export const playerPositionValues = ["GK", "CB", "CM", "W", "ST"] as const;

export const playerPositionOptions = [
  { label: "Goalkeeper (GK)", value: "GK" },
  { label: "Center Back (CB)", value: "CB" },
  { label: "Center Midfield (CM)", value: "CM" },
  { label: "Wing (W)", value: "W" },
  { label: "Striker (ST)", value: "ST" },
] as const satisfies ReadonlyArray<{
  label: string;
  value: (typeof playerPositionValues)[number];
}>;

export const optionalPlayerPositionOptions = [
  { label: "None", value: "" },
  ...playerPositionOptions,
] as const;

export const matchTypeValues = [MatchType.LEAGUE, MatchType.FRIENDLY, MatchType.CUP, MatchType.DEVELOPMENT] as const;

import type { GameFormat } from "@/generated/prisma/client";

export const gameFormatOptions = [
  { label: "3-a-side", value: "THREE_A_SIDE" as GameFormat },
  { label: "5-a-side", value: "FIVE_A_SIDE" as GameFormat },
  { label: "7-a-side", value: "SEVEN_A_SIDE" as GameFormat },
  { label: "9-a-side", value: "NINE_A_SIDE" as GameFormat },
  { label: "11-a-side", value: "ELEVEN_A_SIDE" as GameFormat },
] as const;

export const matchTypeOptions = [
  { label: "League", value: MatchType.LEAGUE },
  { label: "Friendly", value: MatchType.FRIENDLY },
  { label: "Cup", value: MatchType.CUP },
  { label: "Development", value: MatchType.DEVELOPMENT },
] as const;

export const matchVenueOptions = [
  { label: "Home", value: MatchVenue.HOME },
  { label: "Away", value: MatchVenue.AWAY },
] as const;

export const goalkeeperAbilityOptions = [
  { label: "No", value: GoalkeeperAbility.NO },
  { label: "Emergency", value: GoalkeeperAbility.EMERGENCY },
  { label: "Yes", value: GoalkeeperAbility.YES },
] as const;
