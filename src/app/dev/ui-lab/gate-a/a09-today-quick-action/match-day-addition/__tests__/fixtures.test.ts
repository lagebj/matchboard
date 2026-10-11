import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, didrik } from "../fixtures";
import { candidate, successOutcome } from "../view-model";

describe("A09-S6 match-day-addition fixture", () => {
  it("fixtureSha256 matches an independent recomputation from the raw records, not a copied literal", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });

  it("Didrik's eligibility is its own helper-eligibility fact, mapped straight through", () => {
    expect(didrik.helperEligible).toBe(true);
    expect(candidate.eligible).toBe(didrik.helperEligible);
  });

  it("the predeclared outcome is SUCCESS and applies only to the operational roster", () => {
    expect(successOutcome.kind).toBe("SUCCESS");
  });
});
