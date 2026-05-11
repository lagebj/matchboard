import { describe, it, expect } from "vitest";
import { isAllowedCoach } from "@/lib/allowlist";

describe("isAllowedCoach", () => {
  it("returns true for an email on the allowlist", () => {
    const original = process.env.ALLOWED_COACH_EMAILS;
    process.env.ALLOWED_COACH_EMAILS = "coach@example.com, other@example.com";
    expect(isAllowedCoach("coach@example.com")).toBe(true);
    expect(isAllowedCoach("other@example.com")).toBe(true);
    process.env.ALLOWED_COACH_EMAILS = original;
  });

  it("returns false for an email not on the allowlist", () => {
    const original = process.env.ALLOWED_COACH_EMAILS;
    process.env.ALLOWED_COACH_EMAILS = "coach@example.com";
    expect(isAllowedCoach("stranger@example.com")).toBe(false);
    process.env.ALLOWED_COACH_EMAILS = original;
  });

  it("returns false when ALLOWED_COACH_EMAILS is not set", () => {
    const original = process.env.ALLOWED_COACH_EMAILS;
    delete process.env.ALLOWED_COACH_EMAILS;
    expect(isAllowedCoach("coach@example.com")).toBe(false);
    process.env.ALLOWED_COACH_EMAILS = original;
  });

  it("compares emails case-insensitively", () => {
    const original = process.env.ALLOWED_COACH_EMAILS;
    process.env.ALLOWED_COACH_EMAILS = "Coach@Example.COM";
    expect(isAllowedCoach("coach@example.com")).toBe(true);
    expect(isAllowedCoach("COACH@EXAMPLE.COM")).toBe(true);
    process.env.ALLOWED_COACH_EMAILS = original;
  });

  it("trims whitespace from allowlist entries", () => {
    const original = process.env.ALLOWED_COACH_EMAILS;
    process.env.ALLOWED_COACH_EMAILS = " coach@example.com , other@example.com ";
    expect(isAllowedCoach("coach@example.com")).toBe(true);
    expect(isAllowedCoach("other@example.com")).toBe(true);
    process.env.ALLOWED_COACH_EMAILS = original;
  });
});