import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, signalText, signalReasonText } from "../fixtures";

describe("A03-S4 integrity-signal fixture", () => {
  it("points back to the match/round, naming the real round label", () => {
    expect(signalText).toMatch(/Round 4/);
    expect(signalReasonText).toMatch(/RCM/);
  });

  it("fixtureSha256 matches an independent recomputation from the raw records", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("scenario id is A03-S4", () => {
    expect(identity.scenarioId).toBe("A03-S4");
  });
});
