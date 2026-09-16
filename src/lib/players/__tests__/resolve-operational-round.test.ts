import { describe, it, expect } from "vitest";
import { computeDefaultOperationalRoundId } from "../resolve-operational-round";

/**
 * Matchboard Players Operating Surface bundle, `08_TEST_AND_ACCEPTANCE_MATRIX.md §D`: pure
 * decision function for the Players route's operational-round default, using real kickoff
 * dates rather than round name/ordering.
 */
describe("computeDefaultOperationalRoundId", () => {
  const now = new Date("2026-09-16T10:00:00.000Z"); // Wednesday

  it("chooses the round whose kickoff falls in the current display week", () => {
    const result = computeDefaultOperationalRoundId(
      [
        { roundId: "past", kickoffs: [new Date("2026-08-01T10:00:00.000Z")] },
        { roundId: "current", kickoffs: [new Date("2026-09-15T10:00:00.000Z")] },
        { roundId: "future", kickoffs: [new Date("2026-10-01T10:00:00.000Z")] },
      ],
      now,
    );
    expect(result).toBe("current");
  });

  it("picks the earliest kickoff when multiple rounds are current", () => {
    const result = computeDefaultOperationalRoundId(
      [
        { roundId: "later-this-week", kickoffs: [new Date("2026-09-18T10:00:00.000Z")] },
        { roundId: "earlier-this-week", kickoffs: [new Date("2026-09-15T09:00:00.000Z")] },
      ],
      now,
    );
    expect(result).toBe("earlier-this-week");
  });

  it("falls back to the earliest future round when no round is current", () => {
    const result = computeDefaultOperationalRoundId(
      [
        { roundId: "far-future", kickoffs: [new Date("2026-11-01T10:00:00.000Z")] },
        { roundId: "near-future", kickoffs: [new Date("2026-09-25T10:00:00.000Z")] },
      ],
      now,
    );
    expect(result).toBe("near-future");
  });

  it("falls back to the latest past round when there is no current or future round", () => {
    const result = computeDefaultOperationalRoundId(
      [
        { roundId: "older", kickoffs: [new Date("2026-08-01T10:00:00.000Z")] },
        { roundId: "recent", kickoffs: [new Date("2026-08-20T10:00:00.000Z")] },
      ],
      now,
    );
    expect(result).toBe("recent");
  });

  it("returns undefined when no round has any kickoff at all (never falls back to round name/order)", () => {
    const result = computeDefaultOperationalRoundId(
      [
        { roundId: "unscheduled-a", kickoffs: [] },
        { roundId: "unscheduled-b", kickoffs: [] },
      ],
      now,
    );
    expect(result).toBeUndefined();
  });

  it("ignores cancelled-match exclusion is the caller's job — a round with zero surviving kickoffs is treated as unscheduled", () => {
    const result = computeDefaultOperationalRoundId([{ roundId: "all-cancelled", kickoffs: [] }], now);
    expect(result).toBeUndefined();
  });
});
