export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("nb-NO", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
  }).format(date);
}

export function getTodayDateInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function parseDateInputToUtcMidday(value: string, fieldLabel: string): Date {
  const [year, month, day] = value.split("-").map(Number);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new Error(`${fieldLabel} must use the YYYY-MM-DD format.`);
  }

  const parsedDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    throw new Error(`${fieldLabel} must be a valid calendar date.`);
  }

  return parsedDate;
}

export function getCalendarDayDifference(laterDate: Date, earlierDate: Date): number {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const utcLater = Date.UTC(
    laterDate.getUTCFullYear(),
    laterDate.getUTCMonth(),
    laterDate.getUTCDate(),
  );
  const utcEarlier = Date.UTC(
    earlierDate.getUTCFullYear(),
    earlierDate.getUTCMonth(),
    earlierDate.getUTCDate(),
  );

  return Math.floor((utcLater - utcEarlier) / millisecondsPerDay);
}

export function isSameCalendarDay(leftDate: Date, rightDate: Date): boolean {
  return (
    leftDate.getUTCFullYear() === rightDate.getUTCFullYear() &&
    leftDate.getUTCMonth() === rightDate.getUTCMonth() &&
    leftDate.getUTCDate() === rightDate.getUTCDate()
  );
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function getWeekRange(date: Date): { startsAt: Date; endsAt: Date } {
  const start = startOfUtcDay(date);
  const weekday = start.getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;

  start.setUTCDate(start.getUTCDate() - daysSinceMonday);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);

  return {
    startsAt: start,
    endsAt: end,
  };
}

export function isInSameWeek(leftDate: Date, rightDate: Date): boolean {
  const leftRange = getWeekRange(leftDate);

  return rightDate >= leftRange.startsAt && rightDate <= leftRange.endsAt;
}
