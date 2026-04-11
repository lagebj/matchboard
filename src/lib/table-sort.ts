export type SortDirection = "asc" | "desc";

export function getNextSortDirection(
  currentKey: string,
  nextKey: string,
  currentDirection: SortDirection,
): SortDirection {
  if (currentKey !== nextKey) {
    return "asc";
  }

  return currentDirection === "asc" ? "desc" : "asc";
}

export function applySortDirection(value: number, direction: SortDirection): number {
  return direction === "asc" ? value : value * -1;
}

export function compareText(left: string | null | undefined, right: string | null | undefined) {
  return (left ?? "").localeCompare(right ?? "", undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

export function compareNumber(
  left: number | null | undefined,
  right: number | null | undefined,
): number {
  return (left ?? Number.NEGATIVE_INFINITY) - (right ?? Number.NEGATIVE_INFINITY);
}

export function compareDate(left: Date | null | undefined, right: Date | null | undefined): number {
  return compareNumber(left?.getTime(), right?.getTime());
}
