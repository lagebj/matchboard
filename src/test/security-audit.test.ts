import { describe, it, expect } from "vitest";

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

  it(".env.example contains required Vercel env vars as placeholders (without ALLOWED_COACH_EMAILS)", async () => {
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
    ];
    for (const v of requiredVars) {
      const line = envExample
        .split("\n")
        .find((l) => l.includes(v) && !l.trimStart().startsWith("#"));
      expect(line, `Missing non-comment line for ${v}`).toBeDefined();
    }
    // ALLOWED_COACH_EMAILS has been removed; auth is membership-based
    expect(envExample).not.toContain("ALLOWED_COACH_EMAILS");
    // MATCHBOARD_ENV should be documented (as a commented placeholder)
    expect(envExample).toContain("MATCHBOARD_ENV");
    // BREVO_TEST_RECIPIENTS should be documented for non-production email safety
    expect(envExample).toContain("BREVO_TEST_RECIPIENTS");
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
    "src/lib/tenancy/tenant-client.ts",
    "src/lib/auth/__tests__/group-context.test.ts",
    "src/test/security-authz.test.ts",
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

describe("Security audit: auth is membership-based, not allowlist-based", () => {
  it("src/lib/allowlist.ts must not exist (allowlist removed)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const allowlistPath = path.join(process.cwd(), "src/lib/allowlist.ts");
    expect(fs.existsSync(allowlistPath)).toBe(false);
  });

  it("no source code references isAllowedCoach or ALLOWED_COACH_EMAILS", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");

    // Test files that verify the absence of these strings are excluded
    const TEST_EXCLUSIONS = [
      "security-audit.test.",
      "auth.test.",
      "mt7-validation.test.",
    ];

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

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      if (content.includes("isAllowedCoach") && !TEST_EXCLUSIONS.some((ex) => file.includes(ex))) {
        violations.push(`${path.relative(process.cwd(), file)}: isAllowedCoach`);
      }
      if (content.includes("ALLOWED_COACH_EMAILS") && !TEST_EXCLUSIONS.some((ex) => file.includes(ex))) {
        violations.push(`${path.relative(process.cwd(), file)}: ALLOWED_COACH_EMAILS`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("middleware does not check ALLOWED_COACH_EMAILS", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const middleware = fs.readFileSync(
      path.join(process.cwd(), "src/middleware.ts"),
      "utf-8",
    );
    expect(middleware).not.toContain("ALLOWED_COACH_EMAILS");
  });

  it("auth.ts signIn callback does not check isAllowedCoach", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const auth = fs.readFileSync(
      path.join(process.cwd(), "src/auth.ts"),
      "utf-8",
    );
    expect(auth).not.toContain("isAllowedCoach");
    expect(auth).not.toContain("ALLOWED_COACH_EMAILS");
  });

  it("getCurrentCoach does not check isAllowedCoach", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const authLib = fs.readFileSync(
      path.join(process.cwd(), "src/lib/auth.ts"),
      "utf-8",
    );
    expect(authLib).not.toContain("isAllowedCoach");
    expect(authLib).not.toContain("ALLOWED_COACH_EMAILS");
  });

  it("health endpoint does not expose business data", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const healthRoute = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/health/route.ts"),
      "utf-8",
    );
    // Health endpoint may expose ok, version, environment — but never business data
    expect(healthRoute).not.toContain("playerCount");
    expect(healthRoute).not.toContain("teamCount");
    expect(healthRoute).not.toContain("matchCount");
    expect(healthRoute).not.toContain("organisationId");
  });

  it("invitation tokens are looked up by hash, not plaintext", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const invitationFile = fs.readFileSync(
      path.join(process.cwd(), "src/lib/organisations/organisation-invitation.ts"),
      "utf-8",
    );
    expect(invitationFile).toContain("hashToken");
    expect(invitationFile).toContain("tokenHash");
    // Plaintext token should be stored for migration compatibility but not used for lookup
    expect(invitationFile).not.toContain("where: { token:");
  });

  it("invite page looks up invitations by token hash", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const invitePage = fs.readFileSync(
      path.join(process.cwd(), "src/app/(app)/invite/[token]/page.tsx"),
      "utf-8",
    );
    expect(invitePage).toContain("hashToken");
    expect(invitePage).toContain("tokenHash");
  });

  it("brevo provider restricts recipients in non-production", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const brevoProvider = fs.readFileSync(
      path.join(process.cwd(), "src/lib/email/brevo-provider.ts"),
      "utf-8",
    );
    expect(brevoProvider).toContain("isTestRecipientAllowed");
    expect(brevoProvider).toContain("BREVO_TEST_RECIPIENTS");
    expect(brevoProvider).toContain("isProduction");
  });
});