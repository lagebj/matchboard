import { describe, it, expect } from "vitest";
import {
  parseVersion,
  formatVersion,
  isValidSemVer,
  isPreOneZero,
  applyBump,
} from "../version-sync";

describe("version-sync", () => {
  describe("parseVersion", () => {
    it("parses valid semver", () => {
      const v = parseVersion("0.1.0");
      expect(v).toEqual({ major: 0, minor: 1, patch: 0 });
    });

    it("parses two-digit components", () => {
      const v = parseVersion("1.23.456");
      expect(v).toEqual({ major: 1, minor: 23, patch: 456 });
    });

    it("throws for invalid format", () => {
      expect(() => parseVersion("abc")).toThrow("Invalid version format");
      expect(() => parseVersion("1.2")).toThrow("Invalid version format");
      expect(() => parseVersion("1.2.3.4")).toThrow("Invalid version format");
    });
  });

  describe("formatVersion", () => {
    it("formats version components", () => {
      expect(formatVersion(0, 1, 0)).toBe("0.1.0");
      expect(formatVersion(1, 23, 456)).toBe("1.23.456");
    });
  });

  describe("isValidSemVer", () => {
    it("returns true for valid versions", () => {
      expect(isValidSemVer("0.1.0")).toBe(true);
      expect(isValidSemVer("1.0.0")).toBe(true);
      expect(isValidSemVer("0.0.1")).toBe(true);
    });

    it("returns false for invalid versions", () => {
      expect(isValidSemVer("abc")).toBe(false);
      expect(isValidSemVer("1.2")).toBe(false);
      expect(isValidSemVer("")).toBe(false);
    });
  });

  describe("isPreOneZero", () => {
    it("returns true for 0.x.y versions", () => {
      expect(isPreOneZero("0.1.0")).toBe(true);
      expect(isPreOneZero("0.99.99")).toBe(true);
    });

    it("returns false for 1.x.y and higher", () => {
      expect(isPreOneZero("1.0.0")).toBe(false);
      expect(isPreOneZero("2.3.4")).toBe(false);
    });
  });

  describe("applyBump", () => {
    it("applies patch bump", () => {
      expect(applyBump("0.1.0", "patch", 0)).toBe("0.1.1");
    });

    it("applies minor bump", () => {
      expect(applyBump("0.1.0", "minor", 0)).toBe("0.2.0");
    });

    it("applies major bump as minor when locked at 0", () => {
      expect(applyBump("0.1.0", "major", 0)).toBe("0.2.0");
    });

    it("applies major bump when not locked", () => {
      expect(applyBump("1.0.0", "major", null)).toBe("2.0.0");
    });

    it("applies none (no change)", () => {
      expect(applyBump("0.1.0", "none", 0)).toBe("0.1.0");
    });

    it("resets patch on minor bump", () => {
      expect(applyBump("0.1.5", "minor", 0)).toBe("0.2.0");
    });

    it("resets minor and patch on major bump (unlocked)", () => {
      expect(applyBump("1.3.5", "major", null)).toBe("2.0.0");
    });

    it("resets patch on forced-minor bump from major with lock", () => {
      expect(applyBump("0.5.3", "major", 0)).toBe("0.6.0");
    });

    it("enforces major lock at 0 even if current major differs", () => {
      expect(applyBump("1.2.3", "patch", 0)).toBe("0.2.4");
    });

    it("increments patch correctly from 0.2.0", () => {
      expect(applyBump("0.2.0", "patch", 0)).toBe("0.2.1");
    });

    it("increments minor correctly from 0.2.1", () => {
      expect(applyBump("0.2.1", "minor", 0)).toBe("0.3.0");
    });

    it("is idempotent: no change when bump is none", () => {
      const v1 = applyBump("0.1.0", "none", 0);
      const v2 = applyBump(v1, "none", 0);
      expect(v1).toBe("0.1.0");
      expect(v2).toBe("0.1.0");
    });
  });
});