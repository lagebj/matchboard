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

function getIsoWeekParts(date: Date): { week: number; year: number } {
  const isoDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = isoDate.getUTCDay() || 7;

  isoDate.setUTCDate(isoDate.getUTCDate() + 4 - weekday);

  const year = isoDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const dayOffset = Math.floor((isoDate.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000));
  const week = Math.ceil((dayOffset + 1) / 7);

  return {
    week,
    year,
  };
}

function parseIsoWeekKeyParts(weekKey: string): { week: number; year: number } {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekKey);

  if (!match) {
    throw new Error("Week key must use the YYYY-Www format.");
  }

  const year = Number.parseInt(match[1], 10);
  const week = Number.parseInt(match[2], 10);

  if (!Number.isInteger(year) || !Number.isInteger(week) || week < 1 || week > 53) {
    throw new Error("Week key must contain a valid ISO week.");
  }

  return {
    week,
    year,
  };
}

export function formatIsoWeekLabel(date: Date): string {
  const { week, year } = getIsoWeekParts(date);
  return `W${String(week).padStart(2, "0")} ${year}`;
}

export function formatIsoWeekKey(date: Date): string {
  const { week, year } = getIsoWeekParts(date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function getIsoWeekSortValue(date: Date): number {
  const { week, year } = getIsoWeekParts(date);
  return year * 100 + week;
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

export function getWeekRangeFromIsoWeekKey(weekKey: string): { endsAt: Date; startsAt: Date } {
  const { week, year } = parseIsoWeekKeyParts(weekKey);
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const januaryFourthWeekday = januaryFourth.getUTCDay() || 7;
  const firstIsoWeekStart = new Date(januaryFourth);

  firstIsoWeekStart.setUTCDate(januaryFourth.getUTCDate() - januaryFourthWeekday + 1);

  const startsAt = new Date(firstIsoWeekStart);
  startsAt.setUTCDate(firstIsoWeekStart.getUTCDate() + (week - 1) * 7);

  const endsAt = new Date(startsAt);
  endsAt.setUTCDate(startsAt.getUTCDate() + 6);
  endsAt.setUTCHours(23, 59, 59, 999);

  return {
    endsAt,
    startsAt,
  };
}

export function getWeekRange(date: Date): { startsAt: Date; endsAt: Date } {
  const start = startOfUtcDay(date);
  const weekday = start.getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;

  start.setUTCDate(start.getUTCDate() - daysSinceMonday);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);

  return {
    startsAt: start,
    endsAt: end,
  };
}

export function isInSameWeek(leftDate: Date, rightDate: Date): boolean {
  const leftRange = getWeekRange(leftDate);

  return rightDate >= leftRange.startsAt && rightDate <= leftRange.endsAt;
}
