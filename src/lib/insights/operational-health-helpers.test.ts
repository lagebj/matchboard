import { describe, it, expect } from "vitest";
import { totalOperationalHealthCount, OPERATIONAL_HEALTH_LABELS } from "./operational-health-helpers";
import type { OperationalHealthGroup } from "./insights-types";

describe("operational-health-helpers", () => {
  it("sums counts across all groups", () => {
    const groups: OperationalHealthGroup[] = [
      { category: "incomplete_lineups", label: "Incomplete lineups", count: 2, entries: [] },
      { category: "missing_reports", label: "Missing reports", count: 3, entries: [] },
    ];
    expect(totalOperationalHealthCount(groups)).toBe(5);
  });

  it("has a label for every category", () => {
    const categories: OperationalHealthGroup["category"][] = [
      "incomplete_lineups",
      "stale_assignments",
      "missing_reports",
      "unresolved_reviews",
      "unowned_upcoming_work",
      "expiring_support_access",
      "availability_conflicts",
      "invalid_rotation_paths",
      "finalisation_checkpoints",
    ];
    for (const category of categories) {
      expect(OPERATIONAL_HEALTH_LABELS[category]).toBeTruthy();
    }
  });
});
