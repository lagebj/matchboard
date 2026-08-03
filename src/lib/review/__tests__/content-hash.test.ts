import { describe, it, expect } from "vitest";
import { hasTargetChanged } from "../content-hash";

describe("content-hash", () => {
  describe("hasTargetChanged", () => {
    it("returns true when hashes differ", () => {
      expect(hasTargetChanged("hash-old", "hash-new")).toBe(true);
    });

    it("returns false when hashes match", () => {
      expect(hasTargetChanged("hash-abc", "hash-abc")).toBe(false);
    });

    it("returns true when original is empty and current is not", () => {
      expect(hasTargetChanged("", "hash-abc")).toBe(true);
    });

    it("returns true when current is empty and original is not", () => {
      expect(hasTargetChanged("hash-abc", "")).toBe(true);
    });
  });
});