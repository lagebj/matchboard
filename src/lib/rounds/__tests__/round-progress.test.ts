import { describe, it, expect } from "vitest";
import { deriveRoundProgress } from "../round-progress";

const NOW = new Date("2026-06-15T12:00:00Z");
const PAST = new Date("2026-06-01T10:00:00Z");
const FUTURE = new Date("2026-07-01T10:00:00Z");

describe("deriveRoundProgress", () => {
  it("is PLANNING when no matches have been played yet", () => {
    const progress = deriveRoundProgress(
      [{ status: "SCHEDULED", startsAt: FUTURE, reportStatus: "NONE" }],
      NOW,
    );
    expect(progress.stage).toBe("PLANNING");
  });

  it("is PLANNING when the round has no matches at all", () => {
    const progress = deriveRoundProgress([], NOW);
    expect(progress.stage).toBe("PLANNING");
  });

  it("is PARTIALLY_PLAYED when some but not all matches have been played", () => {
    const progress = deriveRoundProgress(
      [
        { status: "SCHEDULED", startsAt: PAST, reportStatus: "NONE" },
        { status: "SCHEDULED", startsAt: FUTURE, reportStatus: "NONE" },
      ],
      NOW,
    );
    expect(progress.stage).toBe("PARTIALLY_PLAYED");
  });

  it("is ALL_PLAYED when every match has been played but no report exists yet", () => {
    const progress = deriveRoundProgress(
      [{ status: "SCHEDULED", startsAt: PAST, reportStatus: "NONE" }],
      NOW,
    );
    expect(progress.stage).toBe("ALL_PLAYED");
  });

  it("is REPORTING when some but not all reports are complete", () => {
    const progress = deriveRoundProgress(
      [
        { status: "SCHEDULED", startsAt: PAST, reportStatus: "LOCKED" },
        { status: "SCHEDULED", startsAt: PAST, reportStatus: "DRAFT" },
      ],
      NOW,
    );
    expect(progress.stage).toBe("REPORTING");
  });

  it("is COMPLETE when every reportable match has a completed report", () => {
    const progress = deriveRoundProgress(
      [
        { status: "SCHEDULED", startsAt: PAST, reportStatus: "LOCKED" },
        { status: "SCHEDULED", startsAt: PAST, reportStatus: "REPORTED" },
      ],
      NOW,
    );
    expect(progress.stage).toBe("COMPLETE");
  });

  it("excludes cancelled matches from both the played and reporting counts", () => {
    const progress = deriveRoundProgress(
      [
        { status: "CANCELLED", startsAt: PAST, reportStatus: "NONE" },
        { status: "SCHEDULED", startsAt: PAST, reportStatus: "LOCKED" },
      ],
      NOW,
    );
    expect(progress.stage).toBe("COMPLETE");
    expect(progress.cancelledMatches).toBe(1);
  });

  it("is PLANNING (not COMPLETE) when every match in the round is cancelled", () => {
    const progress = deriveRoundProgress(
      [{ status: "CANCELLED", startsAt: PAST, reportStatus: "NONE" }],
      NOW,
    );
    expect(progress.stage).toBe("PLANNING");
    expect(progress.cancelledMatches).toBe(1);
  });

  it("a REPORTED (not yet LOCKED) report counts as a completed report", () => {
    const progress = deriveRoundProgress(
      [{ status: "SCHEDULED", startsAt: PAST, reportStatus: "REPORTED" }],
      NOW,
    );
    expect(progress.stage).toBe("COMPLETE");
  });
});
