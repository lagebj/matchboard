import { describe, it, expect } from "vitest";
import {
  classifyCommitMessage,
  calculateBump,
  applyBump,
  parseVersion,
  formatVersion,
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

  describe("classifyCommitMessage", () => {
    it("classifies fix commits as patch", () => {
      expect(classifyCommitMessage("fix: correct typo")).toEqual({ type: "fix", bump: "patch" });
    });

    it("classifies perf commits as patch", () => {
      expect(classifyCommitMessage("perf: optimize loop")).toEqual({ type: "perf", bump: "patch" });
    });

    it("classifies feat commits as minor", () => {
      expect(classifyCommitMessage("feat: add new feature")).toEqual({ type: "feat", bump: "minor" });
    });

    it("classifies feat with scope as minor", () => {
      expect(classifyCommitMessage("feat(auth): add login")).toEqual({ type: "feat", bump: "minor" });
    });

    it("classifies docs commits as none", () => {
      expect(classifyCommitMessage("docs: update readme")).toEqual({ type: "docs", bump: "none" });
    });

    it("classifies test commits as none", () => {
      expect(classifyCommitMessage("test: add unit test")).toEqual({ type: "test", bump: "none" });
    });

    it("classifies chore commits as none", () => {
      expect(classifyCommitMessage("chore: update deps")).toEqual({ type: "chore", bump: "none" });
    });

    it("classifies ci commits as none", () => {
      expect(classifyCommitMessage("ci: configure pipeline")).toEqual({ type: "ci", bump: "none" });
    });

    it("classifies build commits as none", () => {
      expect(classifyCommitMessage("build: update config")).toEqual({ type: "build", bump: "none" });
    });

    it("classifies refactor commits as none", () => {
      expect(classifyCommitMessage("refactor: simplify logic")).toEqual({ type: "refactor", bump: "none" });
    });

    it("classifies breaking change with bang as major", () => {
      expect(classifyCommitMessage("feat!: breaking api change")).toEqual({ type: "feat", bump: "major" });
    });

    it("classifies breaking change with scope and bang as major", () => {
      expect(classifyCommitMessage("fix(api)!: breaking fix")).toEqual({ type: "fix", bump: "major" });
    });

    it("classifies breaking change with footer as major", () => {
      const msg = "feat: add new api\n\nBREAKING CHANGE: old api removed";
      expect(classifyCommitMessage(msg)).toEqual({ type: "feat", bump: "major" });
    });

    it("throws for malformed commit messages", () => {
      expect(() => classifyCommitMessage("random commit message")).toThrow("Malformed conventional commit message");
    });

    it("throws for unknown commit type", () => {
      expect(() => classifyCommitMessage("unknown: something")).toThrow("Unknown conventional commit type");
    });
  });

  describe("calculateBump", () => {
    it("returns none for empty commit list", () => {
      expect(calculateBump([], 0)).toBe("none");
    });

    it("returns patch for fix-only commits", () => {
      const messages = ["fix: bug one", "fix(scope): bug two", "perf: speed improvement"];
      expect(calculateBump(messages, 0)).toBe("patch");
    });

    it("returns minor for feature commits", () => {
      const messages = ["feat: new feature"];
      expect(calculateBump(messages, 0)).toBe("minor");
    });

    it("returns minor for mixed fix+feature commits", () => {
      const messages = ["fix: bug one", "feat: new feature", "perf: speed improvement"];
      expect(calculateBump(messages, 0)).toBe("minor");
    });

    it("downgrades major to minor when major is locked at 0", () => {
      const messages = ["feat!: breaking change"];
      expect(calculateBump(messages, 0)).toBe("minor");
    });

    it("returns major when major is not locked", () => {
      const messages = ["feat!: breaking change"];
      expect(calculateBump(messages, null)).toBe("major");
    });

    it("returns none for documentation-only commits", () => {
      const messages = ["docs: update readme", "test: add tests", "chore: cleanup"];
      expect(calculateBump(messages, 0)).toBe("none");
    });

    it("returns patch when fix commits appear alongside docs/test/chore", () => {
      const messages = ["docs: update readme", "fix: bug fix", "chore: cleanup"];
      expect(calculateBump(messages, 0)).toBe("patch");
    });

    it("returns minor when feat commits appear alongside fix/docs/chore", () => {
      const messages = ["docs: update readme", "fix: bug fix", "feat: new thing", "chore: cleanup"];
      expect(calculateBump(messages, 0)).toBe("minor");
    });

    it("handles breaking change footer correctly with major lock", () => {
      const messages = ["feat: new api\n\nBREAKING CHANGE: removed old api"];
      expect(calculateBump(messages, 0)).toBe("minor");
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

    it("is idempotent: no change when version already matches", () => {
      expect(applyBump("0.1.0", "none", 0)).toBe("0.1.0");
    });

    it("enforces major lock at 0 even if current major differs", () => {
      expect(applyBump("1.2.3", "patch", 0)).toBe("0.2.4");
    });

    it("repeated idempotent sync: applying none twice yields same version", () => {
      const v1 = applyBump("0.1.0", "none", 0);
      const v2 = applyBump(v1, "none", 0);
      expect(v1).toBe("0.1.0");
      expect(v2).toBe("0.1.0");
    });
  });
});