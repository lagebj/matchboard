import { describe, it, expect } from "vitest";
import { releaseTagFor } from "../evidence-tag.mjs";

describe("releaseTagFor", () => {
  it("is deterministic for the same scenario and revision", () => {
    const a = releaseTagFor("B08", "c2e167704a7b2d762a93406ac3746e97c08c1261");
    const b = releaseTagFor("B08", "c2e167704a7b2d762a93406ac3746e97c08c1261");
    expect(a).toBe(b);
  });

  it("differs for a different scenario with the same revision", () => {
    expect(releaseTagFor("B08", "c2e167704a7b2d762a93406ac3746e97c08c1261")).not.toBe(
      releaseTagFor("B07", "c2e167704a7b2d762a93406ac3746e97c08c1261"),
    );
  });

  it("differs for the same scenario with a different revision", () => {
    expect(releaseTagFor("B08", "c2e167704a7b2d762a93406ac3746e97c08c1261")).not.toBe(
      releaseTagFor("B08", "d0afce6a06c842b4c7f6ea62aa8718530d0bb0b2"),
    );
  });

  it("truncates the revision to a short, stable prefix rather than embedding the full SHA", () => {
    expect(releaseTagFor("B08", "c2e167704a7b2d762a93406ac3746e97c08c1261")).toBe("visual-evidence/B08/c2e167704a7b");
  });
});
