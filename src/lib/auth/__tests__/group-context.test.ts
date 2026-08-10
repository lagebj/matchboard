import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => {
  class AuthorizationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "AuthorizationError";
    }
  }
  return { AuthorizationError, requireCoachAccess: vi.fn() };
});

vi.mock("@/lib/db", () => ({
  db: {
    footballGroup: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    groupAccess: {
      findMany: vi.fn(),
    },
  },
}));

import {
  resolveGroupContext,
  requireGroupAccess,
  requireGroupMutationRole,
  hasGroupAccess,
  canMutateGroup,
  canViewGroup,
  getEffectiveGroupAccess,
  type GroupActorContext,
} from "../group-context";
import { AuthorizationError } from "@/lib/auth";
import { db } from "@/lib/db";

const mockOrgId = "org-1";
const mockGroupId = "group-1";
const mockGroupSlug = "boys-2015";
const mockMembershipId = "mem-1";
const mockUserId = "user-1";

function makeOwnerCtx(overrides?: Partial<GroupActorContext>): GroupActorContext {
  return {
    userId: mockUserId,
    email: "owner@test.com",
    membershipId: mockMembershipId,
    organisationId: mockOrgId,
    organisationSlug: "test-org",
    orgRole: "OWNER",
    footballGroupId: mockGroupId,
    groupRole: "GROUP_COACH",
    accessibleGroupIds: [mockGroupId],
    groupAccesses: [{ footballGroupId: mockGroupId, role: "GROUP_COACH" }],
    ...overrides,
  };
}

function makeCoachCtx(overrides?: Partial<GroupActorContext>): GroupActorContext {
  return {
    userId: mockUserId,
    email: "coach@test.com",
    membershipId: mockMembershipId,
    organisationId: mockOrgId,
    organisationSlug: "test-org",
    orgRole: "COACH",
    footballGroupId: mockGroupId,
    groupRole: "GROUP_COACH",
    accessibleGroupIds: [mockGroupId],
    groupAccesses: [{ footballGroupId: mockGroupId, role: "GROUP_COACH" }],
    ...overrides,
  };
}

function makeViewerCtx(): GroupActorContext {
  return {
    userId: mockUserId,
    email: "viewer@test.com",
    membershipId: mockMembershipId,
    organisationId: mockOrgId,
    organisationSlug: "test-org",
    orgRole: "VIEWER",
    footballGroupId: mockGroupId,
    groupRole: "GROUP_VIEWER",
    accessibleGroupIds: [mockGroupId],
    groupAccesses: [{ footballGroupId: mockGroupId, role: "GROUP_VIEWER" }],
  };
}

describe("group-context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("resolveGroupContext", () => {
    it("resolves group context for OWNER with implicit access", async () => {
      vi.mocked(db.footballGroup.findFirst).mockResolvedValue({
        id: mockGroupId,
      } as unknown as Awaited<ReturnType<typeof db.footballGroup.findFirst>>);
      vi.mocked(db.footballGroup.findMany).mockResolvedValue([
        { id: mockGroupId },
        { id: "group-2" },
      ] as unknown as Awaited<ReturnType<typeof db.footballGroup.findMany>>);

      const ctx = await resolveGroupContext(
        mockOrgId,
        mockGroupSlug,
        mockMembershipId,
        "OWNER",
      );

      expect(ctx.footballGroupId).toBe(mockGroupId);
      expect(ctx.groupRole).toBe("GROUP_COACH");
      expect(ctx.accessibleGroupIds).toEqual([mockGroupId, "group-2"]);
      expect(ctx.groupAccesses).toHaveLength(2);
      expect(ctx.groupAccesses.every((ga) => ga.role === "GROUP_COACH")).toBe(true);
    });

    it("resolves group context for COACH with explicit GroupAccess", async () => {
      vi.mocked(db.footballGroup.findFirst).mockResolvedValue({
        id: mockGroupId,
      } as unknown as Awaited<ReturnType<typeof db.footballGroup.findFirst>>);
      vi.mocked(db.groupAccess.findMany).mockResolvedValue([
        { footballGroupId: mockGroupId, role: "GROUP_COACH" },
      ] as unknown as Awaited<ReturnType<typeof db.groupAccess.findMany>>);

      const ctx = await resolveGroupContext(
        mockOrgId,
        mockGroupSlug,
        mockMembershipId,
        "COACH",
      );

      expect(ctx.footballGroupId).toBe(mockGroupId);
      expect(ctx.groupRole).toBe("GROUP_COACH");
      expect(ctx.accessibleGroupIds).toEqual([mockGroupId]);
    });

    it("throws for COACH without GroupAccess", async () => {
      vi.mocked(db.footballGroup.findFirst).mockResolvedValue({
        id: mockGroupId,
      } as unknown as Awaited<ReturnType<typeof db.footballGroup.findFirst>>);
      vi.mocked(db.groupAccess.findMany).mockResolvedValue([]);

      await expect(
        resolveGroupContext(mockOrgId, mockGroupSlug, mockMembershipId, "COACH"),
      ).rejects.toThrow(AuthorizationError);
    });

    it("throws for non-existent group slug", async () => {
      vi.mocked(db.footballGroup.findFirst).mockResolvedValue(null);

      await expect(
        resolveGroupContext(mockOrgId, "nonexistent", mockMembershipId, "COACH"),
      ).rejects.toThrow(AuthorizationError);
    });

    it("resolves group context for VIEWER with GROUP_VIEWER access", async () => {
      vi.mocked(db.footballGroup.findFirst).mockResolvedValue({
        id: mockGroupId,
      } as unknown as Awaited<ReturnType<typeof db.footballGroup.findFirst>>);
      vi.mocked(db.groupAccess.findMany).mockResolvedValue([
        { footballGroupId: mockGroupId, role: "GROUP_VIEWER" },
      ] as unknown as Awaited<ReturnType<typeof db.groupAccess.findMany>>);

      const ctx = await resolveGroupContext(
        mockOrgId,
        mockGroupSlug,
        mockMembershipId,
        "VIEWER",
      );

      expect(ctx.groupRole).toBe("GROUP_VIEWER");
    });
  });

  describe("requireGroupAccess", () => {
    it("allows OWNER access to any group", () => {
      const ctx = makeOwnerCtx();
      expect(() => requireGroupAccess(ctx, "other-group")).not.toThrow();
    });

    it("allows ADMIN access to any group", () => {
      const ctx = makeOwnerCtx({ orgRole: "ADMIN" });
      expect(() => requireGroupAccess(ctx, "other-group")).not.toThrow();
    });

    it("allows COACH access to their group", () => {
      const ctx = makeCoachCtx();
      expect(() => requireGroupAccess(ctx, mockGroupId)).not.toThrow();
    });

    it("denies COACH access to unauthorized group", () => {
      const ctx = makeCoachCtx();
      expect(() => requireGroupAccess(ctx, "other-group")).toThrow(
        AuthorizationError,
      );
    });
  });

  describe("requireGroupMutationRole", () => {
    it("allows OWNER to mutate", () => {
      const ctx = makeOwnerCtx();
      expect(() => requireGroupMutationRole(ctx)).not.toThrow();
    });

    it("allows ADMIN to mutate", () => {
      const ctx = makeOwnerCtx({ orgRole: "ADMIN" });
      expect(() => requireGroupMutationRole(ctx)).not.toThrow();
    });

    it("allows GROUP_COACH to mutate", () => {
      const ctx = makeCoachCtx();
      expect(() => requireGroupMutationRole(ctx)).not.toThrow();
    });

    it("denies GROUP_VIEWER from mutating", () => {
      const ctx = makeViewerCtx();
      expect(() => requireGroupMutationRole(ctx)).toThrow(AuthorizationError);
    });
  });

  describe("hasGroupAccess", () => {
    it("returns true for OWNER accessing any group", () => {
      const ctx = makeOwnerCtx();
      expect(hasGroupAccess(ctx, "any-group")).toBe(true);
    });

    it("returns true for COACH accessing their group", () => {
      const ctx = makeCoachCtx();
      expect(hasGroupAccess(ctx, mockGroupId)).toBe(true);
    });

    it("returns false for COACH accessing unauthorized group", () => {
      const ctx = makeCoachCtx();
      expect(hasGroupAccess(ctx, "other-group")).toBe(false);
    });
  });

  describe("canMutateGroup", () => {
    it("returns true for OWNER", () => {
      expect(canMutateGroup(makeOwnerCtx())).toBe(true);
    });

    it("returns true for GROUP_COACH", () => {
      expect(canMutateGroup(makeCoachCtx())).toBe(true);
    });

    it("returns false for GROUP_VIEWER", () => {
      expect(canMutateGroup(makeViewerCtx())).toBe(false);
    });
  });

  describe("canViewGroup", () => {
    it("returns true for OWNER", () => {
      expect(canViewGroup(makeOwnerCtx())).toBe(true);
    });

    it("returns true for GROUP_COACH", () => {
      expect(canViewGroup(makeCoachCtx())).toBe(true);
    });

    it("returns true for GROUP_VIEWER with explicit access", () => {
      const ctx = makeViewerCtx();
      expect(canViewGroup(ctx)).toBe(true);
    });
  });

  describe("getEffectiveGroupAccess", () => {
    it("returns GROUP_COACH for all groups when OWNER", async () => {
      vi.mocked(db.footballGroup.findMany).mockResolvedValue([
        { id: "group-1" },
        { id: "group-2" },
      ] as unknown as Awaited<ReturnType<typeof db.footballGroup.findMany>>);

      const accesses = await getEffectiveGroupAccess(
        mockMembershipId,
        mockOrgId,
        "OWNER",
      );

      expect(accesses).toHaveLength(2);
      expect(accesses.every((ga) => ga.role === "GROUP_COACH")).toBe(true);
    });

    it("returns GROUP_VIEWER for all groups when SUPPORT", async () => {
      vi.mocked(db.footballGroup.findMany).mockResolvedValue([
        { id: "group-1" },
      ] as unknown as Awaited<ReturnType<typeof db.footballGroup.findMany>>);

      const accesses = await getEffectiveGroupAccess(
        mockMembershipId,
        mockOrgId,
        "SUPPORT",
      );

      expect(accesses).toHaveLength(1);
      expect(accesses[0].role).toBe("GROUP_VIEWER");
    });

    it("returns explicit GroupAccess rows for COACH", async () => {
      vi.mocked(db.groupAccess.findMany).mockResolvedValue([
        { footballGroupId: "group-1", role: "GROUP_COACH" },
        { footballGroupId: "group-2", role: "GROUP_VIEWER" },
      ] as unknown as Awaited<ReturnType<typeof db.groupAccess.findMany>>);

      const accesses = await getEffectiveGroupAccess(
        mockMembershipId,
        mockOrgId,
        "COACH",
      );

      expect(accesses).toHaveLength(2);
      expect(accesses[0].role).toBe("GROUP_COACH");
      expect(accesses[1].role).toBe("GROUP_VIEWER");
    });

    it("returns empty array for COACH without any GroupAccess", async () => {
      vi.mocked(db.groupAccess.findMany).mockResolvedValue([]);

      const accesses = await getEffectiveGroupAccess(
        mockMembershipId,
        mockOrgId,
        "COACH",
      );

      expect(accesses).toHaveLength(0);
    });
  });
});