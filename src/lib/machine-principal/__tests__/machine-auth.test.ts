import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { authenticateWithBearerToken, hasScope, hasAnyScope, hasAllScopes } from "../machine-auth";
import { signMachineToken } from "../machine-token";
import { createMachinePrincipal } from "../machine-principal";
import { setupTestDb, teardownTestDb } from "@/test/test-db";

describe("machine auth", () => {
  let db: PrismaClient;
  let _organisationId: string;
  const originalAuthSecret = process.env.AUTH_SECRET;

  beforeAll(async () => {
    db = await setupTestDb();
    process.env.AUTH_SECRET = "test-secret-for-machine-auth-tests-at-least-32-chars";
    const org = await db.organisation.create({
      data: { name: "Machine Auth Org", slug: "machine-auth-org" },
    });
    _organisationId = org.id;
  });

  afterAll(async () => {
    if (originalAuthSecret) {
      process.env.AUTH_SECRET = originalAuthSecret;
    } else {
      delete process.env.AUTH_SECRET;
    }
    await teardownTestDb();
  });

  describe("authenticateWithBearerToken", () => {
    it("authenticates with valid Bearer token", async () => {
      const org = await db.organisation.create({
        data: { name: "Bearer Test Org", slug: `bearer-test-org-${Date.now()}` },
      });

      const result = await createMachinePrincipal({
        organisationId: org.id,
        name: "Bearer Test Principal",
        scopes: ["scenario:read", "fixtures:read"],
      }, db);

      const token = await signMachineToken({
        principalId: result.principal.id,
        organisationId: org.id,
        scopes: ["scenario:read", "fixtures:read"],
      });

      const auth = await authenticateWithBearerToken(`Bearer ${token}`, db);

      expect(auth.authenticated).toBe(true);
      if (auth.authenticated) {
        expect(auth.principal.id).toBe(result.principal.id);
        expect(auth.principal.organisationId).toBe(org.id);
        expect(auth.principal.scopes).toContain("scenario:read");
      }
    });

    it("rejects request without Authorization header", async () => {
      const auth = await authenticateWithBearerToken(null);
      expect(auth.authenticated).toBe(false);
      if (!auth.authenticated) {
        expect(auth.reason).toBe("No Authorization header");
      }
    });

    it("rejects malformed Authorization header", async () => {
      const auth = await authenticateWithBearerToken("Basic abc123");
      expect(auth.authenticated).toBe(false);
      if (!auth.authenticated) {
        expect(auth.reason).toBe("Invalid Authorization header format");
      }
    });

    it("rejects empty Bearer token", async () => {
      const auth = await authenticateWithBearerToken("Bearer ");
      expect(auth.authenticated).toBe(false);
      if (!auth.authenticated) {
        expect(auth.reason).toContain("Invalid");
      }
    });

    it("rejects invalid token", async () => {
      const auth = await authenticateWithBearerToken("Bearer invalid.jwt.token");
      expect(auth.authenticated).toBe(false);
      if (!auth.authenticated) {
        expect(auth.reason).toContain("Invalid or expired");
      }
    });

    it("rejects token for revoked principal", async () => {
      const org = await db.organisation.create({
        data: { name: "Revoked Auth Org", slug: `revoked-auth-org-${Date.now()}` },
      });

      const result = await createMachinePrincipal({
        organisationId: org.id,
        name: "Revoked Auth Principal",
        scopes: ["scenario:read"],
      }, db);

      const token = await signMachineToken({
        principalId: result.principal.id,
        organisationId: org.id,
        scopes: ["scenario:read"],
      });

      await db.machinePrincipal.update({
        where: { id: result.principal.id },
        data: { status: "REVOKED" },
      });

      const auth = await authenticateWithBearerToken(`Bearer ${token}`, db);
      expect(auth.authenticated).toBe(false);
      if (!auth.authenticated) {
        expect(auth.reason).toBe("Principal revoked");
      }
    });
  });

  describe("scope helpers", () => {
    const authResult = {
      authenticated: true as const,
      principal: {
        id: "test",
        organisationId: "org-1",
        scopes: ["scenario:read", "scenario:execute", "fixtures:read"],
        status: "ACTIVE",
      },
      token: {
        principalId: "test",
        organisationId: "org-1",
        scopes: ["scenario:read", "scenario:execute", "fixtures:read"],
        iat: 0,
        exp: 0,
        jti: "jti",
      },
    };

    it("hasScope checks for a single scope", () => {
      expect(hasScope(authResult, "scenario:read")).toBe(true);
      expect(hasScope(authResult, "selections:write")).toBe(false);
    });

    it("hasAnyScope checks for any matching scope", () => {
      expect(hasAnyScope(authResult, ["selections:write", "scenario:read"])).toBe(true);
      expect(hasAnyScope(authResult, ["selections:write", "players:read"])).toBe(false);
    });

    it("hasAllScopes checks for all matching scopes", () => {
      expect(hasAllScopes(authResult, ["scenario:read", "scenario:execute"])).toBe(true);
      expect(hasAllScopes(authResult, ["scenario:read", "selections:write"])).toBe(false);
    });
  });
});