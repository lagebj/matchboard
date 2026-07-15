type CountRow = {
  count: bigint;
};

export function toNumber(value: bigint | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "bigint") return Number(value);
  return Number(value);
}

export function validateOverviewField(value: unknown, fieldName: string): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (value !== null && typeof value === "object" && "count" in value) {
    const count = (value as { count: unknown }).count;
    if (typeof count === "number" && Number.isFinite(count)) return count;
    if (typeof count === "bigint") return Number(count);
  }
  throw new Error(
    `InsightOverview field "${fieldName}" received unexpected value: ${JSON.stringify(value)}. ` +
    `Expected a number. This indicates a database aggregate query returning an unexpected row shape.`,
  );
}

export type { CountRow };