type LeagueSeasonDisplayInput = {
  seasonName: string;
  leagueSeasonName?: string | null;
  startDate: Date;
  endDate: Date;
};

type LeagueSeasonDisplay = {
  seasonLabel: string;
  leagueSeasonLabel: string;
  dateRangeLabel: string;
  combinedLabel: string;
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const SHORT_MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const SEASON_KEYWORDS = ["spring", "autumn", "fall", "winter", "summer"] as const;

function isMeaningfulLeagueSeasonName(name: string | null | undefined): boolean {
  if (!name) return false;
  const lower = name.toLowerCase().trim();
  if (lower.length < 3) return false;
  return SEASON_KEYWORDS.some((kw) => lower.includes(kw));
}

function extractSeasonYear(name: string | null | undefined, fallbackYear: number): string {
  if (!name) return String(fallbackYear);
  const match = name.match(/\b(20\d{2})\b/);
  return match ? match[1] : String(fallbackYear);
}

function formatFullDateRange(startDate: Date, endDate: Date): string {
  const startMonth = startDate.getUTCMonth();
  const startYear = startDate.getUTCFullYear();
  const endMonth = endDate.getUTCMonth();
  const endYear = endDate.getUTCFullYear();

  if (startMonth === endMonth && startYear === endYear) {
    return `${MONTH_NAMES[startMonth]} ${startYear}`;
  }

  if (startYear === endYear) {
    return `${MONTH_NAMES[startMonth]}\u2013${MONTH_NAMES[endMonth]} ${startYear}`;
  }

  return `${MONTH_NAMES[startMonth]} ${startYear}\u2013${MONTH_NAMES[endMonth]} ${endYear}`;
}

function formatShortDateRange(startDate: Date, endDate: Date): string {
  const startMonth = startDate.getUTCMonth();
  const startYear = startDate.getUTCFullYear();
  const endMonth = endDate.getUTCMonth();
  const endYear = endDate.getUTCFullYear();

  if (startMonth === endMonth && startYear === endYear) {
    return SHORT_MONTH_NAMES[startMonth];
  }

  return `${SHORT_MONTH_NAMES[startMonth]}\u2013${SHORT_MONTH_NAMES[endMonth]}`;
}

export function formatLeagueSeasonDisplay(input: LeagueSeasonDisplayInput): LeagueSeasonDisplay {
  const { seasonName, leagueSeasonName, startDate, endDate } = input;
  const fallbackYear = startDate.getUTCFullYear();
  const seasonYear = extractSeasonYear(seasonName, fallbackYear);
  const seasonLabel = `${seasonYear} Season`;
  const dateRangeLabel = formatShortDateRange(startDate, endDate);
  const fullDateRange = formatFullDateRange(startDate, endDate);

  if (isMeaningfulLeagueSeasonName(leagueSeasonName)) {
    const leagueSeasonLabel = leagueSeasonName!.trim();
    return {
      seasonLabel,
      leagueSeasonLabel,
      dateRangeLabel,
      combinedLabel: `${leagueSeasonLabel} \u00B7 ${dateRangeLabel}`,
    };
  }

  if (leagueSeasonName && leagueSeasonName.trim().length > 0) {
    const leagueSeasonLabel = fullDateRange;
    return {
      seasonLabel,
      leagueSeasonLabel,
      dateRangeLabel,
      combinedLabel: fullDateRange,
    };
  }

  const leagueSeasonLabel = fullDateRange;
  return {
    seasonLabel,
    leagueSeasonLabel,
    dateRangeLabel,
    combinedLabel: fullDateRange,
  };
}

export { formatFullDateRange, formatShortDateRange };

export type { LeagueSeasonDisplayInput, LeagueSeasonDisplay };

export function formatPhaseDisplay(input: {
  seasonName: string;
  phaseName?: string | null;
  startDate: Date;
  endDate: Date;
}): ReturnType<typeof formatLeagueSeasonDisplay> {
  return formatLeagueSeasonDisplay({
    seasonName: input.seasonName,
    leagueSeasonName: input.phaseName,
    startDate: input.startDate,
    endDate: input.endDate,
  });
}