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

export function formatDateRange(
  startDate: Date,
  endDate: Date,
): string {
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