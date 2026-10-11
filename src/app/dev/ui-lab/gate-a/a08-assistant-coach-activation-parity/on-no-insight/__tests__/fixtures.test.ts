import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { identity, rawRecordsForHash, matchInsights } from "../fixtures";

describe("A08-on-no-insight fixture", () => {
  it("status is CURRENT, no AI candidates, deterministic facts present", () => {
    expect(matchInsights.status).toBe("CURRENT");
    expect(matchInsights.insights.length).toBeGreaterThan(0);
    expect(matchInsights.insights.every((i) => i.source === "DETERMINISTIC")).toBe(true);
  });

  it("fixtureSha256 matches an independent recomputation from the raw records", () => {
    const recomputed = createHash("sha256").update(JSON.stringify(rawRecordsForHash)).digest("hex");
    expect(identity.fixtureSha256).toBe(recomputed);
  });
});
