import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDb, mocks } = vi.hoisted(() => {
  const mocks = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    txUpdate: vi.fn(),
    txCreate: vi.fn(),
    $transaction: vi.fn(),
  };
  const mockDb = {
    workOwnership: {
      findUnique: mocks.findUnique,
      findFirst: mocks.findFirst,
      findMany: mocks.findMany,
      create: mocks.create,
      update: mocks.update,
      updateMany: mocks.updateMany,
    },
    $transaction: mocks.$transaction,
  };
  return { mockDb, mocks };
});

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

vi.mock("@/lib/auth", () => {
  class AuthorizationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "AuthorizationError";
    }
  }
  return { AuthorizationError, requireCoachAccess: vi.fn() };
});

import {
  assignWorkOwnership,
  handoverWorkOwnership,
  acknowledgeWorkOwnership,
  getWorkOwnershipForTarget,
} from "@/lib/ownership/work-ownership";

describe("work-ownership handover atomicity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects handover of non-existent ownership", async () => {
    mocks.findUnique.mockResolvedValue(null);

    await expect(
      handoverWorkOwnership({
        ownershipId: "nonexistent",
        newOwnerMembershipId: "mem-2",
        assignedByMembershipId: "mem-1",
        organisationId: "org-1",
      }),
    ).rejects.toThrow("Work ownership not found");
  });

  it("rejects handover from different organisation", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "own-1",
      organisationId: "org-other",
      targetType: "EVENT_SQUAD_PREPARATION",
      targetId: "target-1",
      ownerMembershipId: "mem-1",
      status: "ACTIVE",
    });

    await expect(
      handoverWorkOwnership({
        ownershipId: "own-1",
        newOwnerMembershipId: "mem-2",
        assignedByMembershipId: "mem-1",
        organisationId: "org-1",
      }),
    ).rejects.toThrow("access denied");
  });

  it("rejects handover of completed ownership", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "own-1",
      organisationId: "org-1",
      targetType: "EVENT_SQUAD_PREPARATION",
      targetId: "target-1",
      ownerMembershipId: "mem-1",
      status: "COMPLETED",
    });

    await expect(
      handoverWorkOwnership({
        ownershipId: "own-1",
        newOwnerMembershipId: "mem-2",
        assignedByMembershipId: "mem-1",
        organisationId: "org-1",
      }),
    ).rejects.toThrow("Cannot hand over completed ownership");
  });

  it("rejects double handover of already-handed-over ownership", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "own-1",
      organisationId: "org-1",
      targetType: "EVENT_SQUAD_PREPARATION",
      targetId: "target-1",
      ownerMembershipId: "mem-1",
      status: "HANDED_OVER",
    });

    await expect(
      handoverWorkOwnership({
        ownershipId: "own-1",
        newOwnerMembershipId: "mem-3",
        assignedByMembershipId: "mem-1",
        organisationId: "org-1",
      }),
    ).rejects.toThrow("already been handed over");
  });

  it("performs atomic handover in a transaction", async () => {
    const ownership = {
      id: "own-1",
      organisationId: "org-1",
      targetType: "EVENT_SQUAD_PREPARATION",
      targetId: "target-1",
      ownerMembershipId: "mem-1",
      assignedByMembershipId: "mem-admin",
      status: "ACTIVE",
      dueAt: new Date("2026-12-01"),
      handoverNote: null,
    };

    mocks.findUnique.mockResolvedValue(ownership);

    const newOwnership = {
      id: "own-2",
      organisationId: "org-1",
      targetType: "EVENT_SQUAD_PREPARATION",
      targetId: "target-1",
      ownerMembershipId: "mem-2",
      assignedByMembershipId: "mem-admin",
      status: "ACTIVE",
      dueAt: ownership.dueAt,
      handoverNote: "Handed over",
    };

    mocks.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        workOwnership: {
          update: mocks.txUpdate.mockResolvedValue({ ...ownership, status: "HANDED_OVER" }),
          create: mocks.txCreate.mockResolvedValue(newOwnership),
        },
      };
      return fn(tx);
    });

    const result = await handoverWorkOwnership({
      ownershipId: "own-1",
      newOwnerMembershipId: "mem-2",
      assignedByMembershipId: "mem-admin",
      organisationId: "org-1",
      handoverNote: "Handed over",
    });

    expect(mocks.$transaction).toHaveBeenCalled();
    expect(mocks.txUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "own-1" },
        data: expect.objectContaining({ status: "HANDED_OVER" }),
      }),
    );
    expect(mocks.txCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerMembershipId: "mem-2",
          status: "ACTIVE",
          organisationId: "org-1",
        }),
      }),
    );
  });
});

describe("assignWorkOwnership duplicate prevention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects assignment when an ACTIVE ownership already exists for the same target", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "existing-1",
      targetType: "EVENT_SQUAD_PREPARATION",
      targetId: "target-1",
      status: "ACTIVE",
    });

    await expect(
      assignWorkOwnership({
        organisationId: "org-1",
        targetType: "EVENT_SQUAD_PREPARATION",
        targetId: "target-1",
        ownerMembershipId: "mem-2",
        assignedByMembershipId: "mem-admin",
      }),
    ).rejects.toThrow();
  });

  it("rejects assignment when a HANDED_OVER ownership already exists for the same target", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "existing-1",
      targetType: "EVENT_SQUAD_PREPARATION",
      targetId: "target-1",
      status: "HANDED_OVER",
    });

    await expect(
      assignWorkOwnership({
        organisationId: "org-1",
        targetType: "EVENT_SQUAD_PREPARATION",
        targetId: "target-1",
        ownerMembershipId: "mem-2",
        assignedByMembershipId: "mem-admin",
      }),
    ).rejects.toThrow();
  });

  it("creates ownership when no existing ACTIVE or HANDED_OVER exists", async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockResolvedValue({
      id: "new-1",
      organisationId: "org-1",
      targetType: "EVENT_SQUAD_PREPARATION",
      targetId: "target-1",
      ownerMembershipId: "mem-2",
      assignedByMembershipId: "mem-admin",
      status: "ACTIVE",
    });

    const result = await assignWorkOwnership({
      organisationId: "org-1",
      targetType: "EVENT_SQUAD_PREPARATION",
      targetId: "target-1",
      ownerMembershipId: "mem-2",
      assignedByMembershipId: "mem-admin",
    });

    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organisationId: "org-1",
        targetType: "EVENT_SQUAD_PREPARATION",
        targetId: "target-1",
        ownerMembershipId: "mem-2",
        assignedByMembershipId: "mem-admin",
        status: "ACTIVE",
      }),
    });
  });
});

describe("work-ownership org-scoped access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("acknowledgeWorkOwnership rejects cross-org access", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "own-1",
      organisationId: "org-other",
      status: "ACTIVE",
    });

    await expect(
      acknowledgeWorkOwnership("own-1", "org-1"),
    ).rejects.toThrow("access denied");
  });

  it("acknowledgeWorkOwnership rejects completed ownership", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "own-1",
      organisationId: "org-1",
      status: "COMPLETED",
    });

    await expect(
      acknowledgeWorkOwnership("own-1", "org-1"),
    ).rejects.toThrow("Cannot acknowledge completed ownership");
  });

  it("getWorkOwnershipForTarget uses org filter", async () => {
    mocks.findMany.mockResolvedValue([]);

    await getWorkOwnershipForTarget("EVENT_SQUAD_PREPARATION", "target-1", "org-1");

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { targetType: "EVENT_SQUAD_PREPARATION", targetId: "target-1", organisationId: "org-1" },
      orderBy: { createdAt: "desc" },
    });
  });
});