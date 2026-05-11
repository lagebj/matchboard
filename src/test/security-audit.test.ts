import { describe, it, expect } from "vitest";
import { isAllowedCoach } from "@/lib/allowlist";

describe("Security audit: auth allowlist", () => {
  it("denies access when ALLOWED_COACH_EMAILS is empty string", () => {
    const original = process.env.ALLOWED_COACH_EMAILS;
    process.env.ALLOWED_COACH_EMAILS = "";
    expect(isAllowedCoach("admin@example.com")).toBe(false);
    process.env.ALLOWED_COACH_EMAILS = original;
  });

  it("denies access when ALLOWED_COACH_EMAILS is whitespace only", () => {
    const original = process.env.ALLOWED_COACH_EMAILS;
    process.env.ALLOWED_COACH_EMAILS = "   ";
    expect(isAllowedCoach("admin@example.com")).toBe(false);
    process.env.ALLOWED_COACH_EMAILS = original;
  });

  it("denies access for email with extra spaces not in allowlist", () => {
    const original = process.env.ALLOWED_COACH_EMAILS;
    process.env.ALLOWED_COACH_EMAILS = "coach@example.com";
    expect(isAllowedCoach(" coach@example.com ")).toBe(true);
    expect(isAllowedCoach("coach@other.com")).toBe(false);
    process.env.ALLOWED_COACH_EMAILS = original;
  });

  it("handles single email allowlist", () => {
    const original = process.env.ALLOWED_COACH_EMAILS;
    process.env.ALLOWED_COACH_EMAILS = "only@example.com";
    expect(isAllowedCoach("only@example.com")).toBe(true);
    expect(isAllowedCoach("other@example.com")).toBe(false);
    process.env.ALLOWED_COACH_EMAILS = original;
  });
});

describe("Security audit: .env.example has no real secrets", () => {
  it("does not contain NEXT_PUBLIC_ secrets", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const envExample = fs.readFileSync(
      path.join(process.cwd(), ".env.example"),
      "utf-8",
    );
    const lines = envExample.split("\n");
    const nextPublicSecrets = lines.filter(
      (l) =>
        l.includes("NEXT_PUBLIC_") &&
        (l.includes("SECRET") ||
          l.includes("DATABASE") ||
          l.includes("AUTH_")),
    );
    expect(nextPublicSecrets).toEqual([]);
  });

  it("uses placeholder values for all secrets", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const envExample = fs.readFileSync(
      path.join(process.cwd(), ".env.example"),
      "utf-8",
    );
    const secretKeys = [
      "AUTH_SECRET",
      "AUTH_GOOGLE_ID",
      "AUTH_GOOGLE_SECRET",
    ];
    for (const key of secretKeys) {
      const line = envExample
        .split("\n")
        .find((l) => l.includes(key) && !l.trimStart().startsWith("#"));
      expect(line).toBeDefined();
      expect(line).toContain("replace-with");
    }
  });
});

describe("Security audit: .gitignore coverage", () => {
  it("ignores .env files", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const gitignore = fs.readFileSync(
      path.join(process.cwd(), ".gitignore"),
      "utf-8",
    );
    expect(gitignore).toContain(".env\n");
    expect(gitignore).toContain(".env.local");
    expect(gitignore).toContain(".env.production");
    expect(gitignore).toContain("!.env.example");
    expect(gitignore).toContain("*.db\n");
    expect(gitignore).toContain(".vercel");
  });
});