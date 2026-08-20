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
    "src/test/test-db.ts",
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

  it("app layout does not unconditionally redirect to /organisations (regression: infinite redirect loop, issue #296)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const appLayout = fs.readFileSync(
      path.join(process.cwd(), "src/app/(app)/layout.tsx"),
      "utf-8",
    );
    // /organisations and /invite/[token] live inside this same (app) route
    // group. If this layout redirects to /organisations whenever no single
    // org resolves, visiting /organisations itself loops forever.
    expect(appLayout).not.toContain('redirect("/organisations")');
    expect(appLayout).toContain("getOrgSlugForUser");
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

  it("event live session read actions check org access", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const liveActions = fs.readFileSync(
      path.join(process.cwd(), "src/app/(app)/events/[eventId]/event-live-actions.ts"),
      "utf-8",
    );
    expect(liveActions).toContain("requireEventMatchOrgAccess");
    const getActiveIdx = liveActions.indexOf("getEventActiveSessionAction");
    const getEventsIdx = liveActions.indexOf("getEventMatchEventsAction");
    const getRecentIdx = liveActions.indexOf("getRecentEventEventsAction");
    expect(getActiveIdx).toBeGreaterThan(-1);
    expect(getEventsIdx).toBeGreaterThan(-1);
    expect(getRecentIdx).toBeGreaterThan(-1);
    const beforeGetActive = liveActions.substring(0, getActiveIdx);
    const beforeGetEvents = liveActions.substring(0, getEventsIdx);
    const beforeGetRecent = liveActions.substring(0, getRecentIdx);
    expect(beforeGetActive).toContain("requireEventMatchOrgAccess");
    expect(beforeGetEvents).toContain("requireEventMatchOrgAccess");
    expect(beforeGetRecent).toContain("requireEventMatchOrgAccess");
  });

  it("event live session heartbeat checks org access before mutation", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const liveActions = fs.readFileSync(
      path.join(process.cwd(), "src/app/(app)/events/[eventId]/event-live-actions.ts"),
      "utf-8",
    );
    const heartbeatIdx = liveActions.indexOf("heartbeatEventAction");
    expect(heartbeatIdx).toBeGreaterThan(-1);
    const heartbeatBody = liveActions.substring(heartbeatIdx, heartbeatIdx + 500);
    expect(heartbeatBody).toContain("orgFilter");
  });

  it("event live session end checks org access before mutation", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const liveActions = fs.readFileSync(
      path.join(process.cwd(), "src/app/(app)/events/[eventId]/event-live-actions.ts"),
      "utf-8",
    );
    const endIdx = liveActions.indexOf("endEventLiveSessionAction");
    expect(endIdx).toBeGreaterThan(-1);
    const endBody = liveActions.substring(endIdx, endIdx + 500);
    expect(endBody).toContain("orgFilter");
  });

  it("removePlayersFromEventPoolAction checks event not finalized", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const actionsFile = fs.readFileSync(
      path.join(process.cwd(), "src/app/(app)/events/actions.ts"),
      "utf-8",
    );
    const removeIdx = actionsFile.indexOf("removePlayersFromEventPoolAction");
    expect(removeIdx).toBeGreaterThan(-1);
    const removeBody = actionsFile.substring(removeIdx, removeIdx + 500);
    expect(removeBody).toContain("requireEventNotFinalized");
  });

  it("clearBestLineupSlot passes orgFilter for tenant isolation", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const bestLineupLib = fs.readFileSync(
      path.join(process.cwd(), "src/lib/best-lineup/best-lineup.ts"),
      "utf-8",
    );
    const slotFnIdx = bestLineupLib.indexOf("export async function clearBestLineupSlot(");
    expect(slotFnIdx).toBeGreaterThan(-1);
    const slotFnBody = bestLineupLib.substring(slotFnIdx, slotFnIdx + 400);
    expect(slotFnBody).toContain("orgFilter");
  });

  it("clearBestLineupSlotAction passes orgFilter to library function", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const actionsFile = fs.readFileSync(
      path.join(process.cwd(), "src/app/(app)/o/[orgSlug]/teams/[teamId]/best-lineup-actions/actions.ts"),
      "utf-8",
    );
    const actionIdx = actionsFile.indexOf("clearBestLineupSlotAction");
    expect(actionIdx).toBeGreaterThan(-1);
    const actionBody = actionsFile.substring(actionIdx, actionIdx + 300);
    expect(actionBody).toContain("orgFilter");
  });
});

describe("Security audit: tenant invariant — organisation-owned models are in RLS_TABLES", () => {
  async function getPrismaModels() {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const schema = fs.readFileSync(
      path.join(process.cwd(), "prisma/schema.prisma"),
      "utf-8",
    );
    const models: Record<string, string[]> = {};
    const modelRegex = /^model\s+(\w+)\s*\{/gm;
    let match;
    while ((match = modelRegex.exec(schema)) !== null) {
      const modelName = match[1];
      const modelStart = match.index + match[0].length;
      const modelEnd = schema.indexOf("\n}", modelStart);
      const modelBody = schema.substring(modelStart, modelEnd);
      const fields = modelBody
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("//") && !l.startsWith("@@"))
        .map((l) => l.split(/\s+/)[0]);
      models[modelName] = fields;
    }
    return models;
  }

  it("every model with organisationId is in RLS_TABLES (with documented exceptions)", async () => {
    const models = await getPrismaModels();
    const modelsWithOrgId = Object.entries(models)
      .filter(([_, fields]) => fields.includes("organisationId"))
      .map(([name]) => name);

    const expectedRlsNames = modelsWithOrgId.map((name) =>
      name.charAt(0).toLowerCase() + name.slice(1),
    );

    const { RLS_TABLES } = await import("../lib/db");
    const rlsSet = new Set(RLS_TABLES as unknown as string[]);

    const documentedExceptions = new Set([
      "notificationOutbox",
    ]);

    const missing = expectedRlsNames.filter(
      (name) => !rlsSet.has(name) && !documentedExceptions.has(name),
    );

    expect(missing).toEqual([]);
  });

  it("NotificationOutbox is intentionally excluded from RLS_TABLES (cross-tenant batch)", async () => {
    const { RLS_TABLES } = await import("../lib/db");
    const rlsSet = new Set(RLS_TABLES as unknown as string[]);
    expect(rlsSet.has("notificationOutbox")).toBe(false);
  });

  it("every model in RLS_TABLES has organisationId", async () => {
    const models = await getPrismaModels();
    const { RLS_TABLES } = await import("../lib/db");
    const rlsNames = RLS_TABLES as unknown as string[];

    for (const rlsName of rlsNames) {
      const modelName = rlsName.charAt(0).toUpperCase() + rlsName.slice(1);
      const fields = models[modelName];
      if (!fields) {
        continue;
      }
      const hasOrgId = fields.includes("organisationId");
      expect(hasOrgId).toBe(true);
    }
  });
});

describe("Security audit: authentication architecture", () => {
  it("BYPASS_AUTH is rejected in production by env validation", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const envFile = fs.readFileSync(
      path.join(process.cwd(), "src/lib/env.ts"),
      "utf-8",
    );
    expect(envFile).toContain("BYPASS_AUTH");
    expect(envFile).toContain("must not be set in production");
  });

  it("isBypassAuthEnabled has been removed — BYPASS_AUTH is no longer used for auth bypass", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const envFile = fs.readFileSync(
      path.join(process.cwd(), "src/lib/env.ts"),
      "utf-8",
    );
    const authFile = fs.readFileSync(
      path.join(process.cwd(), "src/lib/auth.ts"),
      "utf-8",
    );
    expect(envFile).not.toContain("isBypassAuthEnabled");
    expect(authFile).not.toContain("isBypassAuthEnabled");
    expect(authFile).not.toContain("BYPASS_AUTH");
  });

  it("APP_BASE_URL is validated in production (required, https)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const envFile = fs.readFileSync(
      path.join(process.cwd(), "src/lib/env.ts"),
      "utf-8",
    );
    expect(envFile).toContain("APP_BASE_URL is required in production");
    expect(envFile).toContain("https://");
  });

  it("BYPASS_AUTH=true is rejected in production by env validation", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const envFile = fs.readFileSync(
      path.join(process.cwd(), "src/lib/env.ts"),
      "utf-8",
    );
    expect(envFile).toContain("BYPASS_AUTH");
    expect(envFile).toContain("must not be set in production");
  });

  it("TEST_AGENT_AUTH_ENABLED=true is rejected in production by env validation", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const envFile = fs.readFileSync(
      path.join(process.cwd(), "src/lib/env.ts"),
      "utf-8",
    );
    expect(envFile).toContain("TEST_AGENT_AUTH_ENABLED");
    expect(envFile).toContain("must not be set in production");
  });

  it("TEST_AGENT_AUTH_SECRET is rejected in production by env validation", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const envFile = fs.readFileSync(
      path.join(process.cwd(), "src/lib/env.ts"),
      "utf-8",
    );
    expect(envFile).toContain("TEST_AGENT_AUTH_SECRET");
    expect(envFile).toContain("must not be set in production");
  });

  it("isTestAgentAuthEnabled is only active in test environment", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const envFile = fs.readFileSync(
      path.join(process.cwd(), "src/lib/env.ts"),
      "utf-8",
    );
    expect(envFile).toContain("isTestAgentAuthEnabled");
  });

  it("getAppBaseUrl does not fall back to AUTH_URL for external links", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const envFile = fs.readFileSync(
      path.join(process.cwd(), "src/lib/env.ts"),
      "utf-8",
    );
    const providerFile = fs.readFileSync(
      path.join(process.cwd(), "src/lib/email/provider.ts"),
      "utf-8",
    );
    expect(envFile).toContain("APP_BASE_URL");
    expect(envFile).not.toContain("return process.env.AUTH_URL");
    expect(providerFile).toContain("_getAppBaseUrl");
    expect(providerFile).not.toContain("AUTH_URL");
    expect(providerFile).not.toContain("localhost:3333");
  });

  it("HSTS header is set in production middleware", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const middlewareFile = fs.readFileSync(
      path.join(process.cwd(), "src/middleware.ts"),
      "utf-8",
    );
    expect(middlewareFile).toContain("Strict-Transport-Security");
    expect(middlewareFile).toContain("isProduction");
  });

  it("environment config reads are centralized through env.ts", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const envFile = fs.readFileSync(
      path.join(process.cwd(), "src/lib/env.ts"),
      "utf-8",
    );

    // These config values should have centralized accessors in env.ts
    expect(envFile).toContain("getEmailFromAddress");
    expect(envFile).toContain("getEmailFromName");
    expect(envFile).toContain("getBrevoApiKey");
    expect(envFile).toContain("getBrevoTestRecipients");
    expect(envFile).toContain("getAuthSecret");
    expect(envFile).toContain("isCspEnforceEnabled");
    expect(envFile).toContain("isRlsDebug");
    expect(envFile).toContain("getPreviewAllowlistEmails");
    expect(envFile).toContain("isVercelPreview");
  });

  it("consumers use centralized env accessors instead of direct process.env", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");

    const providerFactory = fs.readFileSync(
      path.join(process.cwd(), "src/lib/email/provider-factory.ts"),
      "utf-8",
    );
    expect(providerFactory).toContain("getBrevoApiKey");
    expect(providerFactory).not.toContain("process.env.BREVO_API_KEY");

    const brevoProvider = fs.readFileSync(
      path.join(process.cwd(), "src/lib/email/brevo-provider.ts"),
      "utf-8",
    );
    expect(brevoProvider).toContain("getBrevoTestRecipients");
    expect(brevoProvider).not.toContain("process.env.BREVO_TEST_RECIPIENTS");

    const provider = fs.readFileSync(
      path.join(process.cwd(), "src/lib/email/provider.ts"),
      "utf-8",
    );
    expect(provider).toContain("_getEmailFromAddress");
    expect(provider).not.toContain("process.env.EMAIL_FROM_ADDRESS");
    expect(provider).not.toContain("process.env.EMAIL_FROM_NAME");

    const csp = fs.readFileSync(
      path.join(process.cwd(), "src/lib/security/csp.ts"),
      "utf-8",
    );
    expect(csp).toContain("isCspEnforceEnabled");
    expect(csp).not.toContain("process.env.CSP_ENFORCE");

    const machineToken = fs.readFileSync(
      path.join(process.cwd(), "src/lib/machine-principal/machine-token.ts"),
      "utf-8",
    );
    expect(machineToken).toContain("getAuthSecret");
    expect(machineToken).not.toContain("process.env.AUTH_SECRET");

    const db = fs.readFileSync(
      path.join(process.cwd(), "src/lib/db.ts"),
      "utf-8",
    );
    expect(db).toContain("isRlsDebug");
    expect(db).not.toContain("process.env.RLS_DEBUG");

    const middleware = fs.readFileSync(
      path.join(process.cwd(), "src/middleware.ts"),
      "utf-8",
    );
    expect(middleware).toContain("getPreviewAllowlistEmails");
    expect(middleware).toContain("isVercelPreview");
    expect(middleware).not.toContain("process.env.PREVIEW_ALLOWLIST_EMAILS");
    expect(middleware).not.toContain("process.env.VERCEL_ENV");
  });
});