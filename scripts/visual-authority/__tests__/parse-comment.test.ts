import { describe, it, expect } from "vitest";
import { parseCommand } from "../parse-comment.mjs";

describe("parseCommand", () => {
  it("parses a valid approve command with full SHA", () => {
    const result = parseCommand("/visual-approve abc1234def5678901234567890123456789012");
    expect(result.kind).toBe("approve");
    if (result.kind === "approve") {
      expect(result.sha).toBe("abc1234def5678901234567890123456789012");
      expect(result.scenarios).toBeNull();
    }
  });

  it("parses a valid approve command with short SHA and a scenarios line", () => {
    const result = parseCommand("/visual-approve abc1234\nscenarios: B01, B04");
    expect(result.kind).toBe("approve");
    if (result.kind === "approve") {
      expect(result.sha).toBe("abc1234");
      expect(result.scenarios).toEqual(["B01", "B04"]);
    }
  });

  it("parses a valid reject command with a reason", () => {
    const result = parseCommand("/visual-reject abc1234\nThe pitch layout is broken on mobile.");
    expect(result.kind).toBe("reject");
    if (result.kind === "reject") {
      expect(result.sha).toBe("abc1234");
      expect(result.reason).toBe("The pitch layout is broken on mobile.");
    }
  });

  it("parses a reject command with no reason", () => {
    const result = parseCommand("/visual-reject abc1234");
    expect(result.kind).toBe("reject");
    if (result.kind === "reject") expect(result.reason).toBeNull();
  });

  it("parses a deploy-request command", () => {
    expect(parseCommand("/visual-review deploy").kind).toBe("deploy-request");
  });

  it("parses a release-request command", () => {
    expect(parseCommand("/visual-review release").kind).toBe("release-request");
  });

  it("ignores an ordinary conversational comment", () => {
    expect(parseCommand("Looks good to me, nice work!").kind).toBe("none");
  });

  it("ignores a malformed approve command with a non-hex SHA", () => {
    expect(parseCommand("/visual-approve not-a-sha").kind).toBe("none");
  });

  it("ignores a malformed approve command with no SHA at all", () => {
    expect(parseCommand("/visual-approve").kind).toBe("none");
  });

  it("ignores an approve command with a too-long SHA", () => {
    expect(parseCommand("/visual-approve " + "a".repeat(41)).kind).toBe("none");
  });

  it("is tolerant of leading blank lines before the command", () => {
    const result = parseCommand("\n\n   /visual-review deploy  \n");
    expect(result.kind).toBe("deploy-request");
  });

  it("ignores an unrecognized slash command", () => {
    expect(parseCommand("/visual-magic abc1234").kind).toBe("none");
  });
});
