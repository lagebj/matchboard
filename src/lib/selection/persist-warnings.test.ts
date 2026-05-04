import { describe, it, expect } from "vitest";
import { mapWarningSeverity } from "@/lib/selection/persist-warnings";
import { WarningSeverity } from "@/generated/prisma/client";

describe("mapWarningSeverity", () => {
  it("maps hard block codes correctly", () => {
    expect(mapWarningSeverity("player_in_multiple_matches")).toBe(WarningSeverity.HARD_BLOCK);
    expect(mapWarningSeverity("duplicate_player_in_match")).toBe(WarningSeverity.HARD_BLOCK);
    expect(mapWarningSeverity("invariant_invalid_non_core_selection")).toBe(WarningSeverity.HARD_BLOCK);
  });

  it("maps requires override codes correctly", () => {
    expect(mapWarningSeverity("support_requirement_shortfall")).toBe(WarningSeverity.REQUIRES_OVERRIDE);
    expect(mapWarningSeverity("backfill_shortfall_after_resolution")).toBe(WarningSeverity.REQUIRES_OVERRIDE);
    expect(mapWarningSeverity("repair_requires_override")).toBe(WarningSeverity.REQUIRES_OVERRIDE);
  });

  it("maps warning codes correctly", () => {
    expect(mapWarningSeverity("short_squad")).toBe(WarningSeverity.WARNING);
    expect(mapWarningSeverity("core_player_unselected")).toBe(WarningSeverity.WARNING);
    expect(mapWarningSeverity("position_mismatch")).toBe(WarningSeverity.WARNING);
  });

  it("maps scoring preference codes correctly", () => {
    expect(mapWarningSeverity("core_player_overflow")).toBe(WarningSeverity.SCORING_PREFERENCE);
    expect(mapWarningSeverity("round_player_conflict")).toBe(WarningSeverity.SCORING_PREFERENCE);
    expect(mapWarningSeverity("core_match_drop_routed")).toBe(WarningSeverity.SCORING_PREFERENCE);
  });

  it("defaults unknown codes to WARNING", () => {
    expect(mapWarningSeverity("unknown_code")).toBe(WarningSeverity.WARNING);
    expect(mapWarningSeverity("new_future_code")).toBe(WarningSeverity.WARNING);
  });
});