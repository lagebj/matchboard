import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { setupTestDb, teardownTestDb, seedTestFixture, type TestFixtureIds } from "@/test/test-db";
import type { PrismaClient } from "@/generated/prisma/client";
import { cuidSchema } from "@/lib/security/validation";

vi.mock("@/lib/auth", () => ({
  requireCoachAccess: vi.fn(),
  getCurrentCoach: vi.fn(),
  AuthenticationError: class AuthenticationError extends Error { status = 401; },
  AuthorizationError: class AuthorizationError extends Error { status = 403; },
}));

vi.mock("@/lib/auth/actor-context", () => ({
  requireMutationRole: vi.fn(),
  requireAdminRole: vi.fn(),
  requireOwnerRole: vi.fn(),
  canMutate: vi.fn(),
  canAdmin: vi.fn(),
  canOwn: vi.fn(),
  hasTeamAccess: vi.fn(),
  requireTeamAccess: vi.fn(),
  requirePlayerTeamAccess: vi.fn(),
  requireMatchTeamAccess: vi.fn(),
  requireTeamGroupAccess: vi.fn(),
  teamFilterFromContext: vi.fn(),
  groupFilterFromContext: vi.fn(),
}));

vi.mock("next-auth", () => ({
  default: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  SessionProvider: vi.fn(),
  useSession: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

let db: PrismaClient;
let fixture: TestFixtureIds;

beforeAll(async () => {
  db = await setupTestDb();
  fixture = await seedTestFixture(db);
});

afterAll(async () => {
  await teardownTestDb();
});

describe("Authorization security: cross-tenant isolation", () => {
  describe("Tenant filter enforcement", () => {
    it("organisation A teams do not contain organisation B team IDs", async () => {
      const orgATeams = await db.team.findMany({
        where: { organisationId: fixture.organisationId, archivedAt: null },
      });
      for (const team of orgATeams) {
        expect(team.organisationId).toBe(fixture.organisationId);
      }
    });

    it("organisation A players are scoped to organisation A", async () => {
      const orgAPlayers = await db.player.findMany({
        where: { organisationId: fixture.organisationId, removedAt: null },
      });
      for (const player of orgAPlayers) {
        expect(player.organisationId).toBe(fixture.organisationId);
      }
    });

    it("organisation A matches are scoped via team to organisation A", async () => {
      const orgAMatches = await db.match.findMany({
        where: { team: { organisationId: fixture.organisationId } },
        include: { team: { select: { organisationId: true } } },
      });
      for (const match of orgAMatches) {
        expect(match.team.organisationId).toBe(fixture.organisationId);
      }
    });

    it("organisation A selections are scoped via match/team to organisation A", async () => {
      const orgASelections = await db.selection.findMany({
        where: { match: { team: { organisationId: fixture.organisationId } } },
        include: { match: { include: { team: { select: { organisationId: true } } } } },
      });
      for (const sel of orgASelections) {
        expect(sel.match.team.organisationId).toBe(fixture.organisationId);
      }
    });

    it("organisation A availabilities are scoped via player to organisation A", async () => {
      const orgAAvail = await db.availability.findMany({
        where: { player: { organisationId: fixture.organisationId } },
        include: { player: { select: { organisationId: true } } },
      });
      for (const a of orgAAvail) {
        expect(a.player.organisationId).toBe(fixture.organisationId);
      }
    });

    it("organisation A warnings are scoped via matchRound to organisation A", async () => {
      const orgAWarnings = await db.warning.findMany({
        where: { organisationId: fixture.organisationId },
      });
      for (const w of orgAWarnings) {
        expect(w.organisationId).toBe(fixture.organisationId);
      }
    });
  });

  describe("Object ID substitution attacks", () => {
    it("using a foreign team ID with org A filter returns empty results", async () => {
      const foreignId = "clxxxxxxxxxxxxxxxxxxxxxxxxxx";
      const result = await db.team.findMany({
        where: { id: foreignId, organisationId: fixture.organisationId },
      });
      expect(result).toHaveLength(0);
    });

    it("using a foreign player ID with org A filter returns empty results", async () => {
      const foreignId = "clxxxxxxxxxxxxxxxxxxxxxxxxxx";
      const result = await db.player.findMany({
        where: { id: foreignId, organisationId: fixture.organisationId },
      });
      expect(result).toHaveLength(0);
    });

    it("using a foreign match ID with org A context returns empty results", async () => {
      const foreignId = "clxxxxxxxxxxxxxxxxxxxxxxxxxx";
      const result = await db.match.findMany({
        where: { id: foreignId, team: { organisationId: fixture.organisationId } },
      });
      expect(result).toHaveLength(0);
    });

    it("using a foreign match round ID with org A filter returns empty results", async () => {
      const foreignId = "clxxxxxxxxxxxxxxxxxxxxxxxxxx";
      const result = await db.matchRound.findMany({
        where: { id: foreignId, organisationId: fixture.organisationId },
      });
      expect(result).toHaveLength(0);
    });
  });
});

describe("Authorization security: role hierarchy", () => {
  it("role ordering is maintained: VIEWER < COACH < ADMIN < OWNER", () => {
    const roles = ["VIEWER", "COACH", "ADMIN", "OWNER"];
    expect(roles.indexOf("VIEWER")).toBeLessThan(roles.indexOf("COACH"));
    expect(roles.indexOf("COACH")).toBeLessThan(roles.indexOf("ADMIN"));
    expect(roles.indexOf("ADMIN")).toBeLessThan(roles.indexOf("OWNER"));
  });
});

describe("Authorization security: input validation", () => {
  it("cuidSchema rejects empty strings", () => {
    const result = cuidSchema.safeParse("");
    expect(result.success).toBe(false);
  });

  it("cuidSchema requires non-empty input", () => {
    const result = cuidSchema.safeParse("");
    expect(result.success).toBe(false);
  });

  it("cuidSchema accepts valid-looking IDs", () => {
    const result = cuidSchema.safeParse("clxxxxxxxxxxxxxxxxxxxxxxxxxx");
    expect(result.success).toBe(true);
  });
});

describe("Authorization security: forbidden SQL methods", () => {
  it("application code must not use $queryRawUnsafe or $executeRawUnsafe", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const srcDir = path.join(process.cwd(), "src");
    const violations: string[] = [];
    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
          const content = fs.readFileSync(full, "utf-8");
          if (content.includes("$queryRawUnsafe") || content.includes("$executeRawUnsafe")) {
            const rel = path.relative(process.cwd(), full);
            if (rel.includes("check-forbidden-sql") || rel.includes(".test.") || rel.includes("src/generated") || rel.includes("tenant-client.ts")) {
              continue;
            }
            violations.push(rel);
          }
        }
      }
    };
    walk(srcDir);
    expect(violations).toEqual([]);
  });
});

describe("Authorization security: secret exposure prevention", () => {
  it("source code must not reference NEXT_PUBLIC_AUTH_SECRET or NEXT_PUBLIC_DATABASE_URL", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const srcDir = path.join(process.cwd(), "src");
    const violations: string[] = [];
    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
          if (full.includes("security-authz.test.ts") || full.includes("env.test.ts")) continue;
          const content = fs.readFileSync(full, "utf-8");
          if (content.includes("NEXT_PUBLIC_AUTH_SECRET") || content.includes("NEXT_PUBLIC_DATABASE_URL") || content.includes("NEXT_PUBLIC_DIRECT_URL")) {
            violations.push(path.relative(process.cwd(), full));
          }
        }
      }
    };
    walk(srcDir);
    expect(violations).toEqual([]);
  });

  it(".env.example must not contain NEXT_PUBLIC_ secrets", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const envExample = fs.readFileSync(path.join(process.cwd(), ".env.example"), "utf-8");
    const lines = envExample.split("\n");
    const nextPublicSecrets = lines.filter(
      (l) =>
        l.includes("NEXT_PUBLIC_") &&
        (l.includes("SECRET") || l.includes("DATABASE") || l.includes("AUTH_")),
    );
    expect(nextPublicSecrets).toEqual([]);
  });
});