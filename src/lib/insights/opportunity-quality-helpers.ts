import type { OpportunityQualityEntry } from "./insights-types";

export function countBySupportBurden(entries: OpportunityQualityEntry[]): { coreCount: number; supportCount: number } {
  let coreCount = 0;
  let supportCount = 0;
  for (const e of entries) {
    if (e.supportBurden) supportCount++;
    else coreCount++;
  }
  return { coreCount, supportCount };
}

export function formatAttendanceLabel(status: OpportunityQualityEntry["realisedAttendance"]): string {
  switch (status) {
    case "present":
      return "Present";
    case "no_show":
      return "No-show";
    case "unknown":
      return "Unknown";
  }
}
