import { describe, it, expect } from "vitest";
import { computeRecurringThemePhaseSummaries, type RecurringThemeObservation } from "../recurring-theme-facts";

/**
 * `computeRecurringThemePhaseSummaries()` -- extracted unchanged from
 * `weekly-team-review.ts`'s own inline accumulation (ADR-0157 C7) so Season Review can reuse the
 * exact same deterministic logic. These cases mirror the behaviour the original inline code
 * already had: >=2-match minimum, newest-observation tracking, and the newest-first consecutive
 * streak walk.
 */

function obs(partial: Partial<RecurringThemeObservation>): RecurringThemeObservation {
  return { matchId: "m1", phase: "BUILD_UP" as never, polarity: "WORKING" as never, createdAt: new Date("2026-01-01T00:00:00Z"), ...partial };
}

describe("computeRecurringThemePhaseSummaries", () => {
  it("omits a phase seen in only one match", () => {
    const result = computeRecurringThemePhaseSummaries([obs({ matchId: "m1" })], [{ id: "m1" }]);
    expect(result).toEqual([]);
  });

  it("includes a phase once it has evidence in 2 or more matches, tracking working/problem match counts", () => {
    const result = computeRecurringThemePhaseSummaries(
      [
        obs({ matchId: "m1", polarity: "WORKING" as never, createdAt: new Date("2026-01-01T00:00:00Z") }),
        obs({ matchId: "m2", polarity: "PROBLEM" as never, createdAt: new Date("2026-01-08T00:00:00Z") }),
      ],
      [{ id: "m2" }, { id: "m1" }],
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ phase: "BUILD_UP", matchesWithWorking: 1, matchesWithProblem: 1 });
    expect(result[0]!.newestObservationDate).toEqual(new Date("2026-01-08T00:00:00Z"));
  });

  it("computes a consecutive same-direction streak from newest-first recent matches, stopping at the first break", () => {
    const result = computeRecurringThemePhaseSummaries(
      [
        obs({ matchId: "m1", polarity: "WORKING" as never }),
        obs({ matchId: "m2", polarity: "WORKING" as never }),
        obs({ matchId: "m3", polarity: "PROBLEM" as never }),
      ],
      [{ id: "m2" }, { id: "m1" }, { id: "m3" }], // newest-first; m3 (PROBLEM) breaks the WORKING streak
    );
    expect(result[0]!.consecutiveStreak).toEqual({ direction: "WORKING", count: 2 });
  });

  it("respects a custom minMatchCount/maxItems option", () => {
    const observations = [
      obs({ matchId: "m1", phase: "BUILD_UP" as never }),
      obs({ matchId: "m2", phase: "BUILD_UP" as never }),
      obs({ matchId: "m1", phase: "DEFENSIVE_SHAPE" as never }),
      obs({ matchId: "m2", phase: "DEFENSIVE_SHAPE" as never }),
    ];
    const result = computeRecurringThemePhaseSummaries(observations, [{ id: "m2" }, { id: "m1" }], { maxItems: 1 });
    expect(result).toHaveLength(1);
  });

  it("ignores observations with no matchId", () => {
    const result = computeRecurringThemePhaseSummaries([obs({ matchId: null })], [{ id: "m1" }]);
    expect(result).toEqual([]);
  });
});
