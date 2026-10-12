import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, matchInsights, hypothesis } from "../fixtures";

describe("A08-on-strong-pattern fixture", () => {
  it("has a hypothesis and merged AI insight", () => {
    expect(hypothesis.statement.length).toBeGreaterThan(0);
    expect(matchInsights.insights.some((i) => i.source === "AI")).toBe(true);
  });

  it("fixtureSha256 matches an independent recomputation from the raw records", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });
});
