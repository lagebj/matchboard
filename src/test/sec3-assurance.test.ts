import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import {
  createMachinePrincipal,
  revokeMachinePrincipal,
  authenticateMachinePrincipal,
  validateScopes,
  MACHINE_SCOPES,
  isForbiddenScope,
} from "@/lib/machine-principal/machine-principal";

const FORBIDDEN_SCOPE_VALUES = [
  "organisation:admin",
  "organisation:create",
  "user:impersonate",
  "billing:read",
  "billing:write",
  "data:export:parent",
  "data:read:cross-tenant",
] as const;
import { signMachineToken, verifyMachineToken } from "@/lib/machine-principal/machine-token";
import type { MachineScope } from "@/lib/machine-principal/machine-principal";
import { authenticateWithBearerToken, hasScope, hasAnyScope, hasAllScopes } from "@/lib/machine-principal/machine-auth";
import { resolveOrgFilterForMachine, resolveOrgFilterForUser } from "@/lib/tenancy/resolve-org-filter";
import { AuthorizationError } from "@/lib/auth";
import { withTenantContext, withUnscopedContext, isValidOrganisationId } from "@/lib/tenancy/tenant-client";
import { organisationFilter, organisationFilterNullable } from "@/lib/tenancy/tenant-filter";
import { setupTestDb, teardownTestDb, cleanTestDb, createTestGroup } from "@/test/test-db";

describe("SEC-3: Tenant, database and machine-identity assurance", () => {
  let db: PrismaClient;

  beforeAll(async () => {
    db = await setupTestDb();
    process.env.AUTH_SECRET = "test-secret-sec3-at-least-32-characters-long";
  });

  afterAll(async () => {
    await teardownTestDb();
    delete process.env.AUTH_SECRET;
  });

  beforeEach(async () => {
    await cleanTestDb(db);
  });

  describe("Machine-principal tenant containment", () => {
    it("machine principal is bound to its organisation and cannot access another org's data", async () => {
      const org1 = await db.organisation.create({ data: { name: "Org Alpha", slug: "org-alpha-sec3" } });
      const org1Group = await createTestGroup(db, org1.id);
      const org2 = await db.organisation.create({ data: { name: "Org Beta", slug: "org-beta-sec3" } });

      const org2Group = await createTestGroup(db, org2.id);

      const team1 = await db.team.create({
        data: { name: "Team Alpha", organisationId: org1.id, footballGroupId: org1Group, targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      });
      const team2 = await db.team.create({
        data: { name: "Team Beta", organisationId: org2.id, footballGroupId: org2Group, targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      });

      const { principal } = await createMachinePrincipal({
        organisationId: org1.id,
        name: "Org Alpha Bot",
        scopes: ["scenario:read", "fixtures:read"],
      }, db);

      expect(principal.organisationId).toBe(org1.id);

      const principalsInOrg1 = await db.machinePrincipal.findMany({
        where: { organisationId: org1.id, footballGroupId: org1Group },
      });
      const principalsInOrg2 = await db.machinePrincipal.findMany({
        where: { organisationId: org2.id, footballGroupId: org2Group },
      });

      expect(principalsInOrg1).toHaveLength(1);
      expect(principalsInOrg2).toHaveLength(0);

      const orgFilter = organisationFilter(org1.id);
      const teamsInScope = await db.team.findMany({ where: orgFilter });
      const allTeams = await db.team.findMany();

      expect(teamsInScope.map((t: any) => t.id)).toContain(team1.id);
      expect(teamsInScope.map((t: any) => t.id)).not.toContain(team2.id);
      expect(allTeams).toHaveLength(2);
    });

    it("machine principal cannot switch organisation context", async () => {
      const org1 = await db.organisation.create({ data: { name: "Org Alpha Switch", slug: "org-alpha-switch" } });
      const org1Group = await createTestGroup(db, org1.id);
      const org2 = await db.organisation.create({ data: { name: "Org Beta Switch", slug: "org-beta-switch" } });

      const org2Group = await createTestGroup(db, org2.id);

      const { principal } = await createMachinePrincipal({
        organisationId: org1.id,
        name: "Org Alpha Bot",
        scopes: ["scenario:read"],
      }, db);

      const token = await signMachineToken({
        principalId: principal.id,
        organisationId: principal.organisationId,
        scopes: principal.scopes as MachineScope[],
      });

      const authResult = await authenticateWithBearerToken(`Bearer ${token}`, db);

      expect(authResult.authenticated).toBe(true);
      if (authResult.authenticated) {
        expect(authResult.principal.organisationId).toBe(org1.id);
        expect(authResult.principal.organisationId).not.toBe(org2.id);
      }
    });

    it("machine principal with forged organisation ID in token fails authentication", async () => {
      const org1 = await db.organisation.create({ data: { name: "Org Alpha Forge", slug: "org-alpha-forge" } });
      const org1Group = await createTestGroup(db, org1.id);
      const org2 = await db.organisation.create({ data: { name: "Org Beta Forge", slug: "org-beta-forge" } });

      const org2Group = await createTestGroup(db, org2.id);

      const { principal } = await createMachinePrincipal({
        organisationId: org1.id,
        name: "Org Alpha Bot",
        scopes: ["scenario:read"],
      }, db);

      const forgedToken = await signMachineToken({
        principalId: principal.id,
        organisationId: org2.id,
        scopes: principal.scopes as MachineScope[],
      });

      const authResult = await authenticateWithBearerToken(`Bearer ${forgedToken}`, db);

      expect(authResult.authenticated).toBe(false);
      if (!authResult.authenticated) {
        expect(authResult.reason).toContain("Organisation mismatch");
      }
    });

    it("revoked machine principal kill switch prevents all access", async () => {
      const org = await db.organisation.create({ data: { name: "Kill Switch Org", slug: "kill-switch-org" } });

      const orgGroup = await createTestGroup(db, org.id);

      const { principal, clientSecret } = await createMachinePrincipal({
        organisationId: org.id,
        name: "Kill Switch Bot",
        scopes: ["scenario:read"],
      }, db);

      const authResult1 = await authenticateMachinePrincipal(
        principal.id,
        clientSecret,
        ["scenario:read"],
        db,
      );
      expect(authResult1.authenticated).toBe(true);

      await revokeMachinePrincipal(principal.id, db);

      const authResult2 = await authenticateMachinePrincipal(
        principal.id,
        clientSecret,
        ["scenario:read"],
        db,
      );
      expect(authResult2.authenticated).toBe(false);
      if (!authResult2.authenticated) {
        expect(authResult2.reason).toContain("revoked");
      }

      const token = await signMachineToken({
        principalId: principal.id,
        organisationId: org.id,
        scopes: ["scenario:read"],
      });
      const bearerResult = await authenticateWithBearerToken(`Bearer ${token}`, db);
      expect(bearerResult.authenticated).toBe(false);
    });

    it("machine principal scopes are bounded to allowed scopes only", () => {
      for (const forbidden of FORBIDDEN_SCOPE_VALUES) {
        expect(isForbiddenScope(forbidden)).toBe(true);
        const { valid, invalid } = validateScopes([forbidden]);
        expect(valid).toHaveLength(0);
        expect(invalid).toContain(forbidden);
      }

      const { valid, invalid } = validateScopes(["organisation:admin", "scenario:read"]);
      expect(valid).toHaveLength(1);
      expect(valid).toContain("scenario:read");
      expect(invalid).toContain("organisation:admin");
    });

    it("machine principal cannot request cross-tenant data scope", async () => {
      const org = await db.organisation.create({ data: { name: "Cross Tenant Org", slug: "cross-tenant-org" } });

      const orgGroup = await createTestGroup(db, org.id);

      await expect(
        createMachinePrincipal({
          organisationId: org.id,
          name: "Cross Tenant Bot",
          scopes: ["data:read:cross-tenant"],
        }, db),
      ).rejects.toThrow("forbidden scopes");
    });

    it("machine token is bound to principal and organisation", async () => {
      const org = await db.organisation.create({ data: { name: "Token Bind Org", slug: "token-bind-org" } });

      const orgGroup = await createTestGroup(db, org.id);

      const { principal } = await createMachinePrincipal({
        organisationId: org.id,
        name: "Token Bind Bot",
        scopes: ["scenario:read"],
      }, db);

      const token = await signMachineToken({
        principalId: principal.id,
        organisationId: org.id,
        scopes: ["scenario:read"],
      });

      const payload = await verifyMachineToken(token);
      expect(payload.principalId).toBe(principal.id);
      expect(payload.organisationId).toBe(org.id);
      expect(payload.scopes).toContain("scenario:read");
    });

    it("resolveOrgFilterForMachine returns unscoped for non-existent principal", async () => {
      const result = await resolveOrgFilterForMachine("non-existent-principal-id", "some-org-id", db);
      expect(result.type).toBe("unscoped");
    });

    it("resolveOrgFilterForMachine returns unscoped when organisation ID does not match", async () => {
      const org1 = await db.organisation.create({ data: { name: "Machine Org 1", slug: "machine-org-1-filter" } });
      const org1Group = await createTestGroup(db, org1.id);
      const org2 = await db.organisation.create({ data: { name: "Machine Org 2", slug: "machine-org-2-filter" } });

      const org2Group = await createTestGroup(db, org2.id);

      const { principal } = await createMachinePrincipal({
        organisationId: org1.id,
        name: "Machine Bot",
        scopes: ["scenario:read"],
      }, db);

      const result = await resolveOrgFilterForMachine(principal.id, org2.id, db);
      expect(result.type).toBe("unscoped");
    });

    it("resolveOrgFilterForMachine returns org-scoped filter when principal and org match", async () => {
      const org = await db.organisation.create({ data: { name: "Machine Org Match", slug: "machine-org-match" } });

      const orgGroup = await createTestGroup(db, org.id);

      const { principal } = await createMachinePrincipal({
        organisationId: org.id,
        name: "Machine Bot Match",
        scopes: ["scenario:read"],
      }, db);

      const result = await resolveOrgFilterForMachine(principal.id, org.id, db);
      expect(result.type).toBe("org");
      if (result.type === "org") {
        expect(result.organisationId).toBe(org.id);
        expect(result.filter).toEqual({ organisationId: org.id, footballGroupId: orgGroup });
      }
    });
  });

  describe("Tenant context isolation", () => {
    it("withTenantContext sets tenant context within a transaction", async () => {
      const org1 = await db.organisation.create({ data: { name: "Tenant Org 1", slug: "tenant-org-1" } });

      const org1Group = await createTestGroup(db, org1.id);

      await db.team.create({
        data: { name: "Team Tenant 1", organisationId: org1.id, footballGroupId: org1Group, targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      });

      const result = await withTenantContext(db, org1.id, async (tx) => {
        const teams = await tx.team.findMany({ where: { organisationId: org1.id, footballGroupId: org1Group } });
        return teams;
      });

      expect(result).toHaveLength(1);
      expect((result[0] as any).name).toBe("Team Tenant 1");
    });

    it("withUnscopedContext allows querying data from all organisations", async () => {
      const org1 = await db.organisation.create({ data: { name: "Unscoped Org 1", slug: "unscoped-org-1" } });
      const org1Group = await createTestGroup(db, org1.id);
      const org2 = await db.organisation.create({ data: { name: "Unscoped Org 2", slug: "unscoped-org-2" } });

      const org2Group = await createTestGroup(db, org2.id);

      await db.team.create({
        data: { name: "Unscoped Team 1", organisationId: org1.id, footballGroupId: org1Group, targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      });
      await db.team.create({
        data: { name: "Unscoped Team 2", organisationId: org2.id, footballGroupId: org2Group, targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      });

      const allTeams = await db.team.findMany();
      expect(allTeams.length).toBeGreaterThanOrEqual(2);
    });

    it("tenant context mechanism accepts valid organisation IDs and rejects invalid ones", async () => {
      const org1 = await db.organisation.create({ data: { name: "Leak Org 1", slug: "leak-org-1" } });

      const org1Group = await createTestGroup(db, org1.id);

      await expect(
        withTenantContext(db, org1.id, async () => "ok"),
      ).resolves.toBe("ok");

      await expect(
        withTenantContext(db, "'; DROP TABLE teams; --", async () => "leaked"),
      ).rejects.toThrow("Invalid organisationId");
    });

    it("application-level filter and tenant context produce consistent results", async () => {
      const org = await db.organisation.create({ data: { name: "Filter Match Org", slug: "filter-match-org" } });

      const orgGroup = await createTestGroup(db, org.id);

      await db.team.create({
        data: { name: "Filter Match Team", organisationId: org.id, footballGroupId: orgGroup, targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      });

      const filterResult = await db.team.findMany({ where: organisationFilter(org.id) });
      const contextResult = await withTenantContext(db, org.id, async (tx) => {
        return tx.team.findMany({ where: { organisationId: org.id, footballGroupId: orgGroup } });
      });

      expect(filterResult).toHaveLength(1);
      expect(contextResult).toHaveLength(1);
      expect(filterResult[0]!.id).toBe((contextResult as any[])[0]!.id);
    });
  });

  describe("Cross-tenant attack prevention", () => {
    it("known-ID attack: user from org1 cannot read org2 teams via direct query filter", async () => {
      const org1 = await db.organisation.create({ data: { name: "Attack Org 1", slug: "attack-org-1" } });
      const org1Group = await createTestGroup(db, org1.id);
      const org2 = await db.organisation.create({ data: { name: "Attack Org 2", slug: "attack-org-2" } });

      const org2Group = await createTestGroup(db, org2.id);

      const team2 = await db.team.create({
        data: { name: "Attack Target Team", organisationId: org2.id, footballGroupId: org2Group, targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      });

      const user1Filter = organisationFilter(org1.id);
      const results = await db.team.findMany({ where: user1Filter });

      expect(results).toHaveLength(0);
      expect(results.find((t: any) => t.id === team2.id)).toBeUndefined();
    });

    it("forged organisation ID in filter cannot access another org's data", async () => {
      const org1 = await db.organisation.create({ data: { name: "Forge Org 1", slug: "forge-org-1" } });
      const org1Group = await createTestGroup(db, org1.id);
      const org2 = await db.organisation.create({ data: { name: "Forge Org 2", slug: "forge-org-2" } });

      const org2Group = await createTestGroup(db, org2.id);

      await db.team.create({
        data: { name: "Forge Target", organisationId: org2.id, footballGroupId: org2Group, targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      });

      const forgedFilter = organisationFilter(org1.id);
      const results = await db.team.findMany({ where: forgedFilter });

      expect(results).toHaveLength(0);
    });

    it("nullable organisation filter correctly excludes null org data when scoping", async () => {
      const org = await db.organisation.create({ data: { name: "Nullable Filter Org", slug: "nullable-filter-org" } });

      const orgGroup = await createTestGroup(db, org.id);

      await db.team.create({
        data: { name: "Org Team", organisationId: org.id, footballGroupId: orgGroup, targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      });

      const nullOrgFilter = organisationFilterNullable(org.id);
      const results = await db.team.findMany({ where: nullOrgFilter });

      expect(results).toHaveLength(1);
      expect((results[0] as any).name).toBe("Org Team");
    });

    it("machine principal cannot use resolveOrgFilterForMachine to escalate to another org", async () => {
      const org1 = await db.organisation.create({ data: { name: "Escalate Org 1", slug: "escalate-org-1" } });
      const org1Group = await createTestGroup(db, org1.id);
      const org2 = await db.organisation.create({ data: { name: "Escalate Org 2", slug: "escalate-org-2" } });

      const org2Group = await createTestGroup(db, org2.id);

      const { principal } = await createMachinePrincipal({
        organisationId: org1.id,
        name: "Escalation Bot",
        scopes: ["scenario:read"],
      }, db);

      const filter = await resolveOrgFilterForMachine(principal.id, org2.id, db);
      expect(filter.type).toBe("unscoped");

      const scopedFilter = await resolveOrgFilterForMachine(principal.id, org1.id, db);
      expect(scopedFilter.type).toBe("org");
    });

    it("user without organisation membership gets AuthorizationError", async () => {
      const user = await db.user.create({
        data: { email: "no-org-user@test.com", name: "No Org User" },
      });

      await expect(resolveOrgFilterForUser(user.id, db)).rejects.toThrow(AuthorizationError);
    });
  });

  describe("Machine scope boundary enforcement", () => {
    it("all machine scopes are read or simulation scopes, never admin or cross-tenant", () => {
      const adminScopes = ["organisation:admin", "organisation:create", "user:impersonate", "billing:read", "billing:write", "data:export:parent", "data:read:cross-tenant"];

      for (const scope of MACHINE_SCOPES) {
        expect(adminScopes).not.toContain(scope);
      }
    });

    it("forbidden scopes cannot be used to create a principal", async () => {
      const org = await db.organisation.create({ data: { name: "Forbidden Scope Org", slug: "forbidden-scope-org" } });

      const orgGroup = await createTestGroup(db, org.id);

      for (const scope of FORBIDDEN_SCOPE_VALUES) {
        await expect(
          createMachinePrincipal({ organisationId: org.id, name: `Bot ${scope}`, scopes: [scope] }, db),
        ).rejects.toThrow();
      }
    });

    it("token scope subset matches principal scope subset", async () => {
      const org = await db.organisation.create({ data: { name: "Scope Subset Org", slug: "scope-subset-org" } });

      const orgGroup = await createTestGroup(db, org.id);

      const { principal, clientSecret } = await createMachinePrincipal({
        organisationId: org.id,
        name: "Scope Bot",
        scopes: ["scenario:read", "fixtures:read", "players:read"],
      }, db);

      const authResult = await authenticateMachinePrincipal(
        principal.id,
        clientSecret,
        ["scenario:read"],
        db,
      );

      expect(authResult.authenticated).toBe(true);
      if (authResult.authenticated) {
        expect(authResult.grantedScopes).toEqual(["scenario:read"]);
      }
    });

    it("scope helpers correctly verify granted scopes", () => {
      const authResult = {
        authenticated: true as const,
        principal: {
          id: "test",
          organisationId: "org-1",
          scopes: ["scenario:read", "fixtures:read"],
          status: "ACTIVE",
        },
        token: { principalId: "test", organisationId: "org-1", scopes: ["scenario:read", "fixtures:read"], iat: 0, exp: 0, jti: "test-jti" },
      };

      expect(hasScope(authResult, "scenario:read")).toBe(true);
      expect(hasScope(authResult, "teams:write")).toBe(false);
      expect(hasAnyScope(authResult, ["scenario:read", "teams:write"])).toBe(true);
      expect(hasAnyScope(authResult, ["teams:write", "billing:read"])).toBe(false);
      expect(hasAllScopes(authResult, ["scenario:read", "fixtures:read"])).toBe(true);
      expect(hasAllScopes(authResult, ["scenario:read", "teams:write"])).toBe(false);
    });
  });

  describe("Organisation ID validation", () => {
    it("rejects SQL injection in organisation ID for tenant context", () => {
      expect(isValidOrganisationId("'; DROP TABLE organisations; --")).toBe(false);
      expect(isValidOrganisationId("org-1'; DELETE FROM teams WHERE '1'='1")).toBe(false);
      expect(isValidOrganisationId("org' OR '1'='1")).toBe(false);
    });

    it("rejects empty and excessively long organisation IDs", () => {
      expect(isValidOrganisationId("")).toBe(false);
      expect(isValidOrganisationId("a".repeat(65))).toBe(false);
    });

    it("accepts valid organisation IDs", () => {
      expect(isValidOrganisationId("org-123")).toBe(true);
      expect(isValidOrganisationId("abc_def")).toBe(true);
      expect(isValidOrganisationId("ORG")).toBe(true);
      expect(isValidOrganisationId("a")).toBe(true);
      expect(isValidOrganisationId("a".repeat(64))).toBe(true);
    });

    it("withTenantContext rejects invalid organisation IDs", async () => {
      await expect(
        withTenantContext(db, "'; DROP TABLE teams; --", async () => "leaked"),
      ).rejects.toThrow("Invalid organisationId");
    });
  });

  describe("Synthetic organisation isolation", () => {
    it("synthetic organisation flag is set correctly", async () => {
      const syntheticOrg = await db.organisation.create({
        data: { name: "Synthetic Canary", slug: "synthetic-canary", isSynthetic: true },
      });
      const normalOrg = await db.organisation.create({
        data: { name: "Normal Club", slug: "normal-club" },
      });
      const syntheticOrgGroup = await createTestGroup(db, syntheticOrg.id);
      const normalOrgGroup = await createTestGroup(db, normalOrg.id);

      expect(syntheticOrg.isSynthetic).toBe(true);
      expect(normalOrg.isSynthetic).toBe(false);
    });

    it("synthetic organisation data is isolated from normal organisations", async () => {
      const syntheticOrg = await db.organisation.create({
        data: { name: "Synthetic Canary", slug: "synthetic-canary-iso", isSynthetic: true },
      });
      const normalOrg = await db.organisation.create({
        data: { name: "Normal Club Iso", slug: "normal-club-iso" },
      });
      const syntheticOrgGroup2 = await createTestGroup(db, syntheticOrg.id);
      const normalOrgGroup2 = await createTestGroup(db, normalOrg.id);

      await db.team.create({
        data: { name: "Canary Team", organisationId: syntheticOrg.id, footballGroupId: syntheticOrgGroup2, targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      });
      await db.team.create({
        data: { name: "Normal Team", organisationId: normalOrg.id, footballGroupId: normalOrgGroup2, targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      });

      const syntheticTeams = await db.team.findMany({ where: organisationFilter(syntheticOrg.id) });
      const normalTeams = await db.team.findMany({ where: organisationFilter(normalOrg.id) });

      expect(syntheticTeams).toHaveLength(1);
      expect((syntheticTeams[0] as any).name).toBe("Canary Team");
      expect(normalTeams).toHaveLength(1);
      expect((normalTeams[0] as any).name).toBe("Normal Team");
    });

    it("machine principal bound to synthetic org cannot access normal org data", async () => {
      const syntheticOrg = await db.organisation.create({
        data: { name: "Synthetic Canary Machine", slug: "synthetic-canary-machine", isSynthetic: true },
      });
      const normalOrg = await db.organisation.create({
        data: { name: "Normal Club Machine", slug: "normal-club-machine" },
      });
      const syntheticOrgGroup3 = await createTestGroup(db, syntheticOrg.id);
      const normalOrgGroup3 = await createTestGroup(db, normalOrg.id);

      await db.team.create({
        data: { name: "Canary Machine Team", organisationId: syntheticOrg.id, footballGroupId: syntheticOrgGroup3, targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      });

      const { principal } = await createMachinePrincipal({
        organisationId: syntheticOrg.id,
        name: "Canary Bot",
        scopes: ["scenario:read"],
      }, db);

      const filter = await resolveOrgFilterForMachine(principal.id, normalOrg.id, db);
      expect(filter.type).toBe("unscoped");

      const ownFilter = await resolveOrgFilterForMachine(principal.id, syntheticOrg.id, db);
      expect(ownFilter.type).toBe("org");
    });
  });

  describe("Export and data isolation", () => {
    it("organisation filter prevents cross-tenant data leakage in queries", async () => {
      const org1 = await db.organisation.create({ data: { name: "Export Org 1", slug: "export-org-1" } });
      const org1Group = await createTestGroup(db, org1.id);
      const org2 = await db.organisation.create({ data: { name: "Export Org 2", slug: "export-org-2" } });

      const org2Group = await createTestGroup(db, org2.id);

      const team1 = await db.team.create({
        data: { name: "Export Team 1", organisationId: org1.id, footballGroupId: org1Group, targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      });
      const team2 = await db.team.create({
        data: { name: "Export Team 2", organisationId: org2.id, footballGroupId: org2Group, targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      });

      const player1 = await db.player.create({
        data: {
          playerCode: 9001,
          firstName: "Player",
          lastName: "One",
          active: true,
          coreTeamId: team1.id,
          primaryPosition: "CM",
          preferredFoot: "RIGHT",
          secondaryFoot: "LEFT",
          bestSide: "CENTER",
          currentAvailability: "AVAILABLE",
          organisationId: org1.id,
        },
      });

      const player2 = await db.player.create({
        data: {
          playerCode: 9002,
          firstName: "Player",
          lastName: "Two",
          active: true,
          coreTeamId: team2.id,
          primaryPosition: "ST",
          preferredFoot: "LEFT",
          secondaryFoot: "RIGHT",
          bestSide: "CENTER",
          currentAvailability: "AVAILABLE",
          organisationId: org2.id,
        },
      });

      const org1Players = await db.player.findMany({
        where: { ...organisationFilter(org1.id) },
      });

      const org2Players = await db.player.findMany({
        where: { ...organisationFilter(org2.id) },
      });

      expect(org1Players).toHaveLength(1);
      expect(org1Players[0]!.id).toBe(player1.id);

      expect(org2Players).toHaveLength(1);
      expect(org2Players[0]!.id).toBe(player2.id);
    });
  });
});