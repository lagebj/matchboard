import {
  AvailabilityStatus,
  BestSide,
  FootPreference,
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
  { label: "Injured", value: AvailabilityStatus.INJURED },
  { label: "Sick", value: AvailabilityStatus.SICK },
  { label: "Away", value: AvailabilityStatus.AWAY },
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

export const matchTypeValues = ["League", "Friendly", "Cup", "Development"] as const;

export const matchTypeOptions = matchTypeValues.map((matchType) => ({
  label: matchType,
  value: matchType,
})) as ReadonlyArray<{
  label: string;
  value: (typeof matchTypeValues)[number];
}>;

export const matchVenueOptions = [
  { label: "Home", value: MatchVenue.HOME },
  { label: "Away", value: MatchVenue.AWAY },
] as const;
