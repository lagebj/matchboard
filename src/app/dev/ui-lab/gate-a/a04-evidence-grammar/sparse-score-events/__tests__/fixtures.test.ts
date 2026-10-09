import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { canonicalResult, eventLog, identity, rawRecordsForHash } from "../fixtures";
import { finalScoreLabel, buildResultSourceRecords, buildEventSourceRecords } from "../view-model";

describe("A04-S4 sparse-score-events fixture", () => {
  it("the canonical result is exactly 6-4", () => {
    expect(canonicalResult.homeScore).toBe(6);
    expect(canonicalResult.awayScore).toBe(4);
    expect(finalScoreLabel()).toBe("6–4");
  });

  it("the event log has exactly one logged GOAL_FOR event, not recomputed from the score difference", () => {
    expect(eventLog.events).toHaveLength(1);
    expect(eventLog.events[0].type).toBe("GOAL_FOR");
    expect(eventLog.events[0].minute).toBe(34);
    // The score difference (6-4=2) must never be used to infer a second synthetic event.
    expect(eventLog.events).not.toHaveLength(Math.abs(canonicalResult.homeScore - canonicalResult.awayScore));
  });

  it("final score coverage is COMPLETE while event-log coverage is PARTIAL — independent states", () => {
    expect(canonicalResult.coverage).toBe("COMPLETE");
    expect(eventLog.coverage).toBe("PARTIAL");
  });

  describe("independent review round 1 (PR #778, finding R3): scoped source builders", () => {
    it("the result source list contains only the result record, never the event", () => {
      const sources = buildResultSourceRecords();
      expect(sources).toHaveLength(1);
      expect(sources[0].fieldLabel).toBe("Final score");
    });

    it("the event source list contains only the event record, never the result", () => {
      const sources = buildEventSourceRecords();
      expect(sources).toHaveLength(1);
      expect(sources[0].fieldLabel).toBe("GOAL_FOR");
    });
  });

  it("fixtureSha256 matches an independent recomputation", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });
});
