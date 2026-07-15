export function buildDeltaSummary(
  plannedCount: number,
  presentCount: number,
  absentCount: number,
  unplannedCount: number,
): string {
  const parts: string[] = [];

  if (plannedCount === presentCount && absentCount === 0 && unplannedCount === 0) {
    return "All planned players attended.";
  }

  if (absentCount > 0) {
    parts.push(`${absentCount} planned player${absentCount === 1 ? "" : "s"} did not attend`);
  }

  if (unplannedCount > 0) {
    parts.push(`${unplannedCount} unplanned player${unplannedCount === 1 ? "" : "s"} participated`);
  }

  if (plannedCount !== presentCount) {
    parts.push(`${plannedCount} planned vs ${presentCount} actual`);
  }

  return parts.join(". ") + ".";
}