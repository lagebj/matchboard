import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createInvitation,
  acceptInvitation,
  revokeInvitation,
  declineInvitation,
  hashToken,
  generateToken,
} from "../organisation-invitation";
import { createHash } from "crypto";

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

  describe("hashToken", () => {
    it("produces consistent SHA-256 hex digest", () => {
      const token = "abc123";
      const hash = hashToken(token);
      const expected = createHash("sha256").update(token).digest("hex");
      expect(hash).toBe(expected);
    });

    it("produces different hashes for different tokens", () => {
      expect(hashToken("token-a")).not.toBe(hashToken("token-b"));
    });
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

    it("creates invitation with tokenHash", async () => {
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
      if (result.success) {
        expect(result.invitationId).toBe("inv-new");
        expect(result.token).toBeDefined();
        expect(result.token!.length).toBeGreaterThanOrEqual(32);
      }
      const createCall = vi.mocked(db.organisationInvitation.create).mock.calls[0][0];
      expect(createCall.data.tokenHash).toBeDefined();
      expect(createCall.data.tokenHash).toBe(hashToken(createCall.data.token as string));
    });
  });

  describe("acceptInvitation", () => {
    it("rejects when invitation not found (token hash lookup)", async () => {
      vi.mocked(db.organisationInvitation.findFirst).mockResolvedValue(null);
      const result = await acceptInvitation({
        token: "nonexistent",
        userId: "user1",
        userEmail: "new@example.com",
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("not found");
    });

    it("looks up invitation by token hash, not plaintext token", async () => {
      vi.mocked(db.organisationInvitation.findFirst).mockResolvedValue(null);
      await acceptInvitation({
        token: "test-token-value",
        userId: "user1",
        userEmail: "new@example.com",
      });
      const findFirstCall = vi.mocked(db.organisationInvitation.findFirst).mock.calls[0];
      expect(findFirstCall?.[0]?.where).toEqual({ tokenHash: hashToken("test-token-value") });
    });

    it("rejects when invitation is already accepted", async () => {
      vi.mocked(db.organisationInvitation.findFirst).mockResolvedValue({
        id: "inv1",
        status: "ACCEPTED" as const,
        invitedEmail: "new@example.com",
        intendedRole: "COACH" as const,
        organisationId: "org1",
        expiresAt: new Date(Date.now() + 86400000),
      } as unknown as Awaited<ReturnType<typeof db.organisationInvitation.findFirst>>);
      const result = await acceptInvitation({
        token: "token1",
        userId: "user1",
        userEmail: "new@example.com",
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("accepted");
    });

    it("rejects when email does not match", async () => {
      vi.mocked(db.organisationInvitation.findFirst).mockResolvedValue({
        id: "inv1",
        status: "PENDING" as const,
        invitedEmail: "correct@example.com",
        intendedRole: "COACH" as const,
        organisationId: "org1",
        expiresAt: new Date(Date.now() + 86400000),
      } as unknown as Awaited<ReturnType<typeof db.organisationInvitation.findFirst>>);
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

  describe("declineInvitation", () => {
    it("returns error when invitation not found (token hash lookup)", async () => {
      vi.mocked(db.organisationInvitation.findFirst).mockResolvedValue(null);
      const result = await declineInvitation({ token: "bad-token", userId: "u1", userEmail: "test@example.com" });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("not found");
    });

    it("returns error when invitation is not PENDING", async () => {
      vi.mocked(db.organisationInvitation.findFirst).mockResolvedValue({
        id: "inv1",
        invitedEmail: "test@example.com",
        status: "ACCEPTED" as const,
        expiresAt: new Date(),
      } as unknown as Awaited<ReturnType<typeof db.organisationInvitation.findFirst>>);
      const result = await declineInvitation({ token: "tok1", userId: "u1", userEmail: "test@example.com" });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("accepted");
    });

    it("returns error when email does not match", async () => {
      vi.mocked(db.organisationInvitation.findFirst).mockResolvedValue({
        id: "inv1",
        invitedEmail: "other@example.com",
        status: "PENDING" as const,
        expiresAt: new Date(),
      } as unknown as Awaited<ReturnType<typeof db.organisationInvitation.findFirst>>);
      const result = await declineInvitation({ token: "tok1", userId: "u1", userEmail: "test@example.com" });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("different email");
    });

    it("declines a PENDING invitation", async () => {
      vi.mocked(db.organisationInvitation.findFirst).mockResolvedValue({
        id: "inv1",
        invitedEmail: "test@example.com",
        status: "PENDING" as const,
        expiresAt: new Date(),
      } as unknown as Awaited<ReturnType<typeof db.organisationInvitation.findFirst>>);
      vi.mocked(db.organisationInvitation.update).mockResolvedValue({ id: "inv1" } as unknown as Awaited<ReturnType<typeof db.organisationInvitation.update>>);
      const result = await declineInvitation({ token: "tok1", userId: "u1", userEmail: "test@example.com" });
      expect(result.success).toBe(true);
      expect(db.organisationInvitation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "DECLINED" }),
        }),
      );
    });
  });

  describe("security: negative tests", () => {
    it("rejects accept with a tampered (wrong hash) token", async () => {
      vi.mocked(db.organisationInvitation.findFirst).mockResolvedValue(null);
      const result = await acceptInvitation({
        token: "tampered-token-value",
        userId: "user1",
        userEmail: "new@example.com",
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("not found");
      expect(db.organisationInvitation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tokenHash: hashToken("tampered-token-value") },
        }),
      );
    });

    it("rejects accept with an empty token", async () => {
      const result = await acceptInvitation({
        token: "",
        userId: "user1",
        userEmail: "new@example.com",
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("not found");
    });

    it("rejects accept with an expired invitation", async () => {
      vi.mocked(db.organisationInvitation.findFirst).mockResolvedValue({
        id: "inv1",
        status: "PENDING" as const,
        invitedEmail: "new@example.com",
        intendedRole: "COACH" as const,
        organisationId: "org1",
        expiresAt: new Date("2020-01-01"),
      } as unknown as Awaited<ReturnType<typeof db.organisationInvitation.findFirst>>);
      vi.mocked(db.organisationInvitation.update).mockResolvedValue({ id: "inv1" } as unknown as Awaited<ReturnType<typeof db.organisationInvitation.update>>);
      const result = await acceptInvitation({
        token: "expired-token",
        userId: "user1",
        userEmail: "new@example.com",
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("expired");
    });

    it("rejects accept when already a member", async () => {
      vi.mocked(db.organisationInvitation.findFirst).mockResolvedValue({
        id: "inv1",
        status: "PENDING" as const,
        invitedEmail: "new@example.com",
        intendedRole: "COACH" as const,
        organisationId: "org1",
        expiresAt: new Date(Date.now() + 86400000),
      } as unknown as Awaited<ReturnType<typeof db.organisationInvitation.findFirst>>);
      vi.mocked(db.organisationMembership.findUnique).mockResolvedValue({ id: "mem1" } as unknown as Awaited<ReturnType<typeof db.organisationMembership.findUnique>>);
      const result = await acceptInvitation({
        token: "valid-token",
        userId: "user1",
        userEmail: "new@example.com",
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("already a member");
    });

    it("rejects revoke when invitation not found", async () => {
      vi.mocked(db.organisationInvitation.findUnique).mockResolvedValue(null);
      const result = await revokeInvitation({
        invitationId: "nonexistent",
        revokerRole: "OWNER",
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("not found");
    });

    it("rejects revoke of already-accepted invitation", async () => {
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

    it("rejects revoke of already-revoked invitation", async () => {
      vi.mocked(db.organisationInvitation.findUnique).mockResolvedValue({
        id: "inv1",
        status: "REVOKED" as const,
      } as unknown as Awaited<ReturnType<typeof db.organisationInvitation.findUnique>>);
      const result = await revokeInvitation({
        invitationId: "inv1",
        revokerRole: "OWNER",
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("Cannot revoke");
    });

    it("rejects decline when invitation already declined", async () => {
      vi.mocked(db.organisationInvitation.findFirst).mockResolvedValue({
        id: "inv1",
        invitedEmail: "test@example.com",
        status: "DECLINED" as const,
        expiresAt: new Date(),
      } as unknown as Awaited<ReturnType<typeof db.organisationInvitation.findFirst>>);
      const result = await declineInvitation({ token: "tok1", userId: "u1", userEmail: "test@example.com" });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("declined");
    });

    it("generates different tokens for different invitations", async () => {
      const token1 = generateToken();
      const token2 = generateToken();
      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(32);
    });

    it("hashes tokens deterministically", () => {
      const token = "test-token-123";
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64);
    });

    it("produces different hashes for different tokens", () => {
      expect(hashToken("token-a")).not.toBe(hashToken("token-b"));
    });
  });
});