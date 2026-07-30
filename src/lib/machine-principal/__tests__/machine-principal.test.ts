import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, cleanTestDb } from "@/test/test-db";
import {
  isValidScope,
  isForbiddenScope,
  validateScopes,
  hashClientSecret,
  generateClientSecret,
  extractClientSecretPrefix,
  verifyClientSecret,
  createMachinePrincipal,
  revokeMachinePrincipal,
  reactivateMachinePrincipal,
  authenticateMachinePrincipal,
  rotateClientSecret,
  MACHINE_SCOPES,
} from "../machine-principal";

describe("machine principal domain logic", () => {
  let db: PrismaClient;
  let organisationId: string;

  beforeAll(async () => {
    db = await setupTestDb();
    const org = await db.organisation.create({
      data: { name: "Test Org MP", slug: "test-org-mp" },
    });
    organisationId = org.id;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await db.machinePrincipal.deleteMany();
  });

  describe("scope validation", () => {
    it("recognizes valid machine scopes", () => {
      expect(isValidScope("scenario:read")).toBe(true);
      expect(isValidScope("scenario:execute")).toBe(true);
      expect(isValidScope("selections:write")).toBe(true);
    });

    it("rejects invalid scopes", () => {
      expect(isValidScope("admin:super")).toBe(false);
      expect(isValidScope("")).toBe(false);
    });

    it("identifies forbidden scopes", () => {
      expect(isForbiddenScope("organisation:admin")).toBe(true);
      expect(isForbiddenScope("user:impersonate")).toBe(true);
      expect(isForbiddenScope("data:read:cross-tenant")).toBe(true);
    });

    it("does not treat valid scopes as forbidden", () => {
      expect(isForbiddenScope("scenario:read")).toBe(false);
      expect(isForbiddenScope("selections:write")).toBe(false);
    });

    it("validateScopes separates valid and invalid scopes", () => {
      const result = validateScopes(["scenario:read", "organisation:admin", "invalid:scope"]);
      expect(result.valid).toEqual(["scenario:read"]);
      expect(result.invalid).toEqual(["organisation:admin", "invalid:scope"]);
    });

    it("validateScopes returns empty valid array for all-forbidden input", () => {
      const result = validateScopes(["organisation:admin", "user:impersonate"]);
      expect(result.valid).toEqual([]);
      expect(result.invalid).toEqual(["organisation:admin", "user:impersonate"]);
    });
  });

  describe("client secret hashing", () => {
    it("hashes and verifies client secrets", () => {
      const secret = generateClientSecret();
      const hash = hashClientSecret(secret);
      expect(verifyClientSecret(secret, hash)).toBe(true);
      expect(verifyClientSecret("wrong-secret", hash)).toBe(false);
    });

    it("generates unique client secrets", () => {
      const s1 = generateClientSecret();
      const s2 = generateClientSecret();
      expect(s1).not.toBe(s2);
    });

    it("extracts client secret prefix", () => {
      const secret = "abcdefghijklmnop";
      const prefix = extractClientSecretPrefix(secret);
      expect(prefix).toBe("abcdefgh");
      expect(prefix.length).toBe(8);
    });
  });

  describe("createMachinePrincipal", () => {
    it("creates a machine principal with valid scopes", async () => {
      const result = await createMachinePrincipal({
        organisationId,
        name: "CI Runner",
        description: "Continuous integration runner",
        scopes: ["scenario:read", "scenario:execute"],
      }, db);

      expect(result.principal.name).toBe("CI Runner");
      expect(result.principal.organisationId).toBe(organisationId);
      expect(result.principal.scopes).toEqual(["scenario:read", "scenario:execute"]);
      expect(result.principal.status).toBe("ACTIVE");
      expect(result.principal.clientCredentialPrefix).toBeDefined();
      expect(result.clientSecret).toBeDefined();
      expect(result.clientSecret.length).toBeGreaterThan(20);

      const dbPrincipal = await db.machinePrincipal.findUnique({
        where: { id: result.principal.id },
      });
      expect(dbPrincipal).not.toBeNull();
      expect(dbPrincipal!.clientCredentialHash).toBeDefined();
    });

    it("rejects creation with forbidden scopes", async () => {
      await expect(
        createMachinePrincipal({
          organisationId,
          name: "Bad Actor",
          scopes: ["organisation:admin", "scenario:read"],
        }, db),
      ).rejects.toThrow("Invalid or forbidden scopes");
    });

    it("rejects creation with no valid scopes", async () => {
      await expect(
        createMachinePrincipal({
          organisationId,
          name: "No Scopes",
          scopes: [],
        }, db),
      ).rejects.toThrow("At least one valid scope");
    });
  });

  describe("revokeMachinePrincipal", () => {
    it("revokes an active principal", async () => {
      const result = await createMachinePrincipal({
        organisationId,
        name: "Revoke Test",
        scopes: ["scenario:read"],
      }, db);

      await revokeMachinePrincipal(result.principal.id, db);

      const principal = await db.machinePrincipal.findUnique({
        where: { id: result.principal.id },
      });
      expect(principal!.status).toBe("REVOKED");
    });

    it("is idempotent for already revoked principal", async () => {
      const result = await createMachinePrincipal({
        organisationId,
        name: "Revoke Idempotent",
        scopes: ["scenario:read"],
      }, db);

      await revokeMachinePrincipal(result.principal.id, db);
      await revokeMachinePrincipal(result.principal.id, db);

      const principal = await db.machinePrincipal.findUnique({
        where: { id: result.principal.id },
      });
      expect(principal!.status).toBe("REVOKED");
    });

    it("throws for non-existent principal", async () => {
      await expect(
        revokeMachinePrincipal("nonexistent", db),
      ).rejects.toThrow("Machine principal not found");
    });
  });

  describe("reactivateMachinePrincipal", () => {
    it("reactivates a revoked principal", async () => {
      const result = await createMachinePrincipal({
        organisationId,
        name: "Reactivate Test",
        scopes: ["scenario:read"],
      }, db);

      await revokeMachinePrincipal(result.principal.id, db);
      await reactivateMachinePrincipal(result.principal.id, db);

      const principal = await db.machinePrincipal.findUnique({
        where: { id: result.principal.id },
      });
      expect(principal!.status).toBe("ACTIVE");
    });

    it("is idempotent for already active principal", async () => {
      const result = await createMachinePrincipal({
        organisationId,
        name: "Reactivate Idempotent",
        scopes: ["scenario:read"],
      }, db);

      await reactivateMachinePrincipal(result.principal.id, db);

      const principal = await db.machinePrincipal.findUnique({
        where: { id: result.principal.id },
      });
      expect(principal!.status).toBe("ACTIVE");
    });
  });

  describe("authenticateMachinePrincipal", () => {
    it("authenticates with valid credentials and scopes", async () => {
      const result = await createMachinePrincipal({
        organisationId,
        name: "Auth Test",
        scopes: ["scenario:read", "scenario:execute", "fixtures:read"],
      }, db);

      const auth = await authenticateMachinePrincipal(
        result.principal.id,
        result.clientSecret,
        ["scenario:read", "fixtures:read"],
        db,
      );

      expect(auth.authenticated).toBe(true);
      expect(auth.principal!.id).toBe(result.principal.id);
      expect(auth.principal!.organisationId).toBe(organisationId);
      expect(auth.grantedScopes).toEqual(["scenario:read", "fixtures:read"]);
    });

    it("rejects authentication with wrong secret", async () => {
      const result = await createMachinePrincipal({
        organisationId,
        name: "Wrong Secret Test",
        scopes: ["scenario:read"],
      }, db);

      const auth = await authenticateMachinePrincipal(
        result.principal.id,
        "wrong-secret",
        ["scenario:read"],
        db,
      );

      expect(auth.authenticated).toBe(false);
      expect(auth.reason).toBe("Invalid client secret");
    });

    it("rejects authentication for revoked principal", async () => {
      const result = await createMachinePrincipal({
        organisationId,
        name: "Revoked Auth Test",
        scopes: ["scenario:read"],
      }, db);

      await revokeMachinePrincipal(result.principal.id, db);

      const auth = await authenticateMachinePrincipal(
        result.principal.id,
        result.clientSecret,
        ["scenario:read"],
        db,
      );

      expect(auth.authenticated).toBe(false);
      expect(auth.reason).toBe("Principal revoked");
    });

    it("rejects authentication for non-existent principal", async () => {
      const auth = await authenticateMachinePrincipal(
        "nonexistent",
        "secret",
        ["scenario:read"],
        db,
      );

      expect(auth.authenticated).toBe(false);
      expect(auth.reason).toBe("Principal not found");
    });

    it("grants only allowed scopes subset", async () => {
      const result = await createMachinePrincipal({
        organisationId,
        name: "Scope Subset Test",
        scopes: ["scenario:read"],
      }, db);

      const auth = await authenticateMachinePrincipal(
        result.principal.id,
        result.clientSecret,
        ["scenario:read", "scenario:execute"],
        db,
      );

      expect(auth.authenticated).toBe(true);
      expect(auth.grantedScopes).toEqual(["scenario:read"]);
    });

    it("rejects authentication when no requested scopes are allowed", async () => {
      const result = await createMachinePrincipal({
        organisationId,
        name: "No Allowed Scopes Test",
        scopes: ["scenario:read"],
      }, db);

      const auth = await authenticateMachinePrincipal(
        result.principal.id,
        result.clientSecret,
        ["scenario:execute"],
        db,
      );

      expect(auth.authenticated).toBe(false);
      expect(auth.reason).toBe("No requested scopes are allowed for this principal");
    });
  });

  describe("rotateClientSecret", () => {
    it("rotates client secret for active principal", async () => {
      const result = await createMachinePrincipal({
        organisationId,
        name: "Rotate Test",
        scopes: ["scenario:read"],
      }, db);

      const rotated = await rotateClientSecret(result.principal.id, db);

      expect(rotated.clientSecret).toBeDefined();
      expect(rotated.clientCredentialPrefix).toBeDefined();
      expect(rotated.clientSecret).not.toBe(result.clientSecret);

      const auth = await authenticateMachinePrincipal(
        result.principal.id,
        rotated.clientSecret,
        ["scenario:read"],
        db,
      );
      expect(auth.authenticated).toBe(true);
    });

    it("rejects rotation for revoked principal", async () => {
      const result = await createMachinePrincipal({
        organisationId,
        name: "Rotate Revoked Test",
        scopes: ["scenario:read"],
      }, db);

      await revokeMachinePrincipal(result.principal.id, db);

      await expect(
        rotateClientSecret(result.principal.id, db),
      ).rejects.toThrow("Cannot rotate client secret for revoked principal");
    });

    it("old secret no longer works after rotation", async () => {
      const result = await createMachinePrincipal({
        organisationId,
        name: "Rotate Old Secret Test",
        scopes: ["scenario:read"],
      }, db);

      await rotateClientSecret(result.principal.id, db);

      const auth = await authenticateMachinePrincipal(
        result.principal.id,
        result.clientSecret,
        ["scenario:read"],
        db,
      );

      expect(auth.authenticated).toBe(false);
      expect(auth.reason).toBe("Invalid client secret");
    });
  });
});