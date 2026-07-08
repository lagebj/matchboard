export type LeagueSeasonPart = "SPRING" | "FALL";

export type LeagueSeasonIdentifier = {
  year: number;
  part: LeagueSeasonPart;
};

export type LeagueSeasonDateRange = {
  startDate: Date;
  endDate: Date;
};

export function getLeagueSeasonPartForDate(date: Date): LeagueSeasonPart {
  const month = date.getMonth();
  return month >= 0 && month <= 5 ? "SPRING" : "FALL";
}

export function getLeagueSeasonYearForDate(date: Date): number {
  return date.getFullYear();
}

export function getLeagueSeasonLabel(date: Date): string {
  const part = getLeagueSeasonPartForDate(date);
  const year = getLeagueSeasonYearForDate(date);
  return part === "SPRING" ? `Spring ${year}` : `Fall ${year}`;
}

export function getLeagueSeasonDateRange(
  year: number,
  part: LeagueSeasonPart,
): LeagueSeasonDateRange {
  if (part === "SPRING") {
    return {
      startDate: new Date(year, 0, 1),
      endDate: new Date(year, 5, 30, 23, 59, 59, 999),
    };
  }
  return {
    startDate: new Date(year, 6, 1),
    endDate: new Date(year, 11, 31, 23, 59, 59, 999),
  };
}

export function getLeagueSeasonIdentifier(
  date: Date,
): LeagueSeasonIdentifier {
  return {
    year: getLeagueSeasonYearForDate(date),
    part: getLeagueSeasonPartForDate(date),
  };
}

export function leagueSeasonIdentifierEquals(
  a: LeagueSeasonIdentifier,
  b: LeagueSeasonIdentifier,
): boolean {
  return a.year === b.year && a.part === b.part;
}

export function formatLeagueSeasonLabel(
  identifier: LeagueSeasonIdentifier,
): string {
  return identifier.part === "SPRING"
    ? `Spring ${identifier.year}`
    : `Fall ${identifier.year}`;
}

export function formatLeagueSeasonDateRange(
  identifier: LeagueSeasonIdentifier,
): string {
  const range = getLeagueSeasonDateRange(identifier.year, identifier.part);
  const startMonth = range.startDate.toLocaleString("en-US", {
    month: "short",
  });
  const endMonth = range.endDate.toLocaleString("en-US", { month: "short" });
  return `${startMonth}–${endMonth} ${identifier.year}`;
}

export function formatCombinedLeagueSeasonLabel(
  identifier: LeagueSeasonIdentifier,
): string {
  const label = formatLeagueSeasonLabel(identifier);
  const dateRange = formatLeagueSeasonDateRange(identifier);
  return `${label} · ${dateRange}`;
}