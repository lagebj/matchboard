import { describe, it, expect } from "vitest";
import { B08_OWNERSHIP_MAP, type OwnershipVerdict } from "../ownership-map";

const VALID_VERDICTS: readonly OwnershipVerdict[] = ["canonical", "contextual-preview", "necessary-shared-identity", "corrected-duplication"];

describe("B08 ownership map", () => {
  it("covers all 9 pairs audited in INFORMATION_OWNERSHIP_MATRIX.md, each with a non-empty topic/owner/note", () => {
    expect(B08_OWNERSHIP_MAP).toHaveLength(9);
    for (const entry of B08_OWNERSHIP_MAP) {
      expect(entry.topic.length).toBeGreaterThan(0);
      expect(entry.owner.length).toBeGreaterThan(0);
      expect(entry.note.length).toBeGreaterThan(0);
      expect(VALID_VERDICTS).toContain(entry.verdict);
    }
  });

  it("every topic is unique — no pair is listed twice", () => {
    const topics = B08_OWNERSHIP_MAP.map((e) => e.topic);
    expect(new Set(topics).size).toBe(topics.length);
  });

  it("flags exactly one corrected-duplication — the report-status widget, matching the audit's flagship finding", () => {
    const corrected = B08_OWNERSHIP_MAP.filter((e) => e.verdict === "corrected-duplication");
    expect(corrected).toHaveLength(1);
    expect(corrected[0]!.topic).toBe("Report status + continue/view-report entry point");
    expect(corrected[0]!.owner).toBe("After match tab");
  });
});
