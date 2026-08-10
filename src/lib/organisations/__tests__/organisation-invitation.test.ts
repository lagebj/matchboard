import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createInvitation,
  acceptInvitation,
  revokeInvitation,
} from "../organisation-invitation";

vi.mock("@/lib/db", () => ({
  db: {
    organisationMembership: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    organisationInvitation: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((ops) => Promise.all(ops)),
  },
}));

import { db } from "@/lib/db";

describe("organisation-invitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createInvitation", () => {
    it("rejects invitation when inviter role cannot invite target role", async () => {
      const result = await createInvitation({
        organisationId: "org1",
        invitedEmail: "new@example.com",
        intendedRole: "ADMIN",
        invitedByUserId: "user1",
        inviterRole: "COACH",
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("cannot invite");
    });

    it("rejects when inviter is not a member", async () => {
      vi.mocked(db.organisationMembership.findUnique).mockResolvedValue(null);
      const result = await createInvitation({
        organisationId: "org1",
        invitedEmail: "new@example.com",
        intendedRole: "COACH",
        invitedByUserId: "user1",
        inviterRole: "OWNER",
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("not a member");
    });

    it("rejects when active invitation already exists", async () => {
      vi.mocked(db.organisationMembership.findUnique).mockResolvedValue({ id: "mem1" } as unknown as Awaited<ReturnType<typeof db.organisationMembership.findUnique>>);
      vi.mocked(db.organisationInvitation.findFirst).mockResolvedValue({ id: "inv1" } as unknown as Awaited<ReturnType<typeof db.organisationInvitation.findFirst>>);
      const result = await createInvitation({
        organisationId: "org1",
        invitedEmail: "new@example.com",
        intendedRole: "COACH",
        invitedByUserId: "user1",
        inviterRole: "OWNER",
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("active invitation already exists");
    });

    it("rejects when user is already a member", async () => {
      vi.mocked(db.organisationMembership.findUnique).mockResolvedValue({ id: "mem1" } as unknown as Awaited<ReturnType<typeof db.organisationMembership.findUnique>>);
      vi.mocked(db.organisationInvitation.findFirst).mockResolvedValue(null);
      vi.mocked(db.organisationMembership.findFirst).mockResolvedValue({ id: "mem2" } as unknown as Awaited<ReturnType<typeof db.organisationMembership.findFirst>>);
      const result = await createInvitation({
        organisationId: "org1",
        invitedEmail: "existing@example.com",
        intendedRole: "COACH",
        invitedByUserId: "user1",
        inviterRole: "OWNER",
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("already a member");
    });

    it("creates invitation when valid", async () => {
      vi.mocked(db.organisationMembership.findUnique).mockResolvedValue({ id: "mem1" } as unknown as Awaited<ReturnType<typeof db.organisationMembership.findUnique>>);
      vi.mocked(db.organisationInvitation.findFirst).mockResolvedValue(null);
      vi.mocked(db.organisationMembership.findFirst).mockResolvedValue(null);
      vi.mocked(db.organisationInvitation.create).mockResolvedValue({ id: "inv-new" } as unknown as Awaited<ReturnType<typeof db.organisationInvitation.create>>);
      const result = await createInvitation({
        organisationId: "org1",
        invitedEmail: "new@example.com",
        intendedRole: "COACH",
        invitedByUserId: "user1",
        inviterRole: "OWNER",
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.invitationId).toBe("inv-new");
    });
  });

  describe("acceptInvitation", () => {
    it("rejects when invitation not found", async () => {
      vi.mocked(db.organisationInvitation.findUnique).mockResolvedValue(null);
      const result = await acceptInvitation({
        token: "nonexistent",
        userId: "user1",
        userEmail: "new@example.com",
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("not found");
    });

    it("rejects when invitation is already accepted", async () => {
      vi.mocked(db.organisationInvitation.findUnique).mockResolvedValue({
        id: "inv1",
        status: "ACCEPTED" as const,
        invitedEmail: "new@example.com",
        intendedRole: "COACH" as const,
        organisationId: "org1",
        expiresAt: new Date(Date.now() + 86400000),
      } as unknown as Awaited<ReturnType<typeof db.organisationInvitation.findUnique>>);
      const result = await acceptInvitation({
        token: "token1",
        userId: "user1",
        userEmail: "new@example.com",
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("accepted");
    });

    it("rejects when email does not match", async () => {
      vi.mocked(db.organisationInvitation.findUnique).mockResolvedValue({
        id: "inv1",
        status: "PENDING" as const,
        invitedEmail: "correct@example.com",
        intendedRole: "COACH" as const,
        organisationId: "org1",
        expiresAt: new Date(Date.now() + 86400000),
      } as unknown as Awaited<ReturnType<typeof db.organisationInvitation.findUnique>>);
      const result = await acceptInvitation({
        token: "token1",
        userId: "user1",
        userEmail: "wrong@example.com",
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("different email");
    });
  });

  describe("revokeInvitation", () => {
    it("rejects when revoker is not OWNER or ADMIN", async () => {
      const result = await revokeInvitation({
        invitationId: "inv1",
        revokerRole: "COACH",
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("OWNER or ADMIN");
    });

    it("rejects when invitation is not PENDING", async () => {
      vi.mocked(db.organisationInvitation.findUnique).mockResolvedValue({
        id: "inv1",
        status: "ACCEPTED" as const,
      } as unknown as Awaited<ReturnType<typeof db.organisationInvitation.findUnique>>);
      const result = await revokeInvitation({
        invitationId: "inv1",
        revokerRole: "OWNER",
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("Cannot revoke");
    });

    it("revokes a PENDING invitation", async () => {
      vi.mocked(db.organisationInvitation.findUnique).mockResolvedValue({
        id: "inv1",
        status: "PENDING" as const,
      } as unknown as Awaited<ReturnType<typeof db.organisationInvitation.findUnique>>);
      vi.mocked(db.organisationInvitation.update).mockResolvedValue({ id: "inv1" } as unknown as Awaited<ReturnType<typeof db.organisationInvitation.update>>);
      const result = await revokeInvitation({
        invitationId: "inv1",
        revokerRole: "OWNER",
      });
      expect(result.success).toBe(true);
    });
  });
});