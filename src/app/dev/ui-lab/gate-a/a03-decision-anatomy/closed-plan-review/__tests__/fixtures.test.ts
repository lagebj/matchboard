import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, reviewText } from "../fixtures";

describe("A03-S2 closed-plan-review fixture", () => {
  it("explains the closed boundary without implying an exception", () => {
    expect(reviewText).toMatch(/planning closed when the match kicked off/i);
    expect(reviewText).toMatch(/genuine reschedule before the actual start/i);
  });

  it("fixtureSha256 matches an independent recomputation from the raw records", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("identity is fixed to the planning-closed simulation clock, 5 minutes after kickoff", () => {
    expect(identity.scenarioId).toBe("A03-S2");
    expect(identity.fixedDateTimeUtc).toBe("2026-10-11T10:05:00.000Z");
  });
});
