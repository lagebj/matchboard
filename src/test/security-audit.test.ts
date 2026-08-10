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

describe("Security audit: Vercel deployment readiness", () => {
  it("postinstall script does not run prisma migrate deploy", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const pkg = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package.json"), "utf-8"),
    );
    const postinstall = pkg.scripts.postinstall;
    expect(postinstall).toBeDefined();
    expect(postinstall).not.toContain("migrate deploy");
    expect(postinstall).toContain("prisma generate");
  });

  it("prisma.config.ts uses DIRECT_URL for CLI operations", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const config = fs.readFileSync(
      path.join(process.cwd(), "prisma.config.ts"),
      "utf-8",
    );
    expect(config).toContain("DIRECT_URL");
    expect(config).toContain("DATABASE_URL");
    expect(config).toMatch(/env\("DIRECT_URL"\)/);
  });

  it("prisma schema uses postgresql provider without inline url", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const schema = fs.readFileSync(
      path.join(process.cwd(), "prisma/schema.prisma"),
      "utf-8",
    );
    expect(schema).toContain('provider = "postgresql"');
    expect(schema).not.toContain("url =");
  });

  it(".env.example contains all required Vercel env vars as placeholders", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const envExample = fs.readFileSync(
      path.join(process.cwd(), ".env.example"),
      "utf-8",
    );
    const requiredVars = [
      "DATABASE_URL",
      "DIRECT_URL",
      "AUTH_SECRET",
      "AUTH_GOOGLE_ID",
      "AUTH_GOOGLE_SECRET",
      "AUTH_URL",
      "ALLOWED_COACH_EMAILS",
    ];
    for (const v of requiredVars) {
      const line = envExample
        .split("\n")
        .find((l) => l.includes(v) && !l.trimStart().startsWith("#"));
      expect(line, `Missing non-comment line for ${v}`).toBeDefined();
    }
  });

  it("runtime db client uses DATABASE_URL and auto-detects Neon", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dbCode = fs.readFileSync(
      path.join(process.cwd(), "src/lib/db.ts"),
      "utf-8",
    );
    expect(dbCode).toContain("DATABASE_URL");
    expect(dbCode).toContain(".neon.tech");
    expect(dbCode).toContain("PrismaNeon");
    expect(dbCode).toContain("PrismaPg");
  });
});

describe("Security audit: forbidden SQL methods", () => {
  const ALLOWED_UNSAFE_FILES = [
    // tenant-client.ts uses $executeRawUnsafe for SET LOCAL session configuration
    // with validated organisation IDs (alphanumeric + hyphen + underscore only).
    // This is a security-reviewed exception for PostgreSQL RLS context injection.
    // Prisma's tagged template $executeRaw does not support parameterised values
    // in SET commands (PostgreSQL syntax error at "$1").
    "src/lib/tenancy/tenant-client.ts",
    // Test mock: db mock includes $executeRawUnsafe and $transaction for Prisma client
    // interface compliance in group-context authorization tests.
    "src/lib/auth/__tests__/group-context.test.ts",
  ];

  it("application code must not use $queryRawUnsafe or $executeRawUnsafe except in allowed files", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");

    function walk(dir: string, files: string[] = []): string[] {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (["generated", "node_modules", ".next"].includes(entry.name)) continue;
          walk(fullPath, files);
        } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
          files.push(fullPath);
        }
      }
      return files;
    }

    const srcDir = path.join(process.cwd(), "src");
    const files = walk(srcDir);
    const violations: string[] = [];
    const allowedAbsPaths = ALLOWED_UNSAFE_FILES.map((f) => path.join(process.cwd(), f));

    for (const file of files) {
      if (file.includes("security-audit.test.")) continue;
      if (allowedAbsPaths.includes(file)) continue;
      const content = fs.readFileSync(file, "utf-8");
      if (content.includes("$queryRawUnsafe")) {
        violations.push(`${path.relative(process.cwd(), file)}: $queryRawUnsafe`);
      }
      if (content.includes("$executeRawUnsafe")) {
        violations.push(`${path.relative(process.cwd(), file)}: $executeRawUnsafe`);
      }
    }

    expect(violations).toEqual([]);
  });
});