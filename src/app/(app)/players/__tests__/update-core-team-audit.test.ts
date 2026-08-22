import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = {
  player: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  team: {
    findFirst: vi.fn(),
  },
  decisionRecord: {
    create: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/actor-context", () => ({
  requirePageActorContext: vi.fn().mockResolvedValue({
    userId: "test-user",
    email: "coach@example.com",
    membershipId: "mem-1",
    organisationId: "org-1",
    organisationSlug: "test-org",
    role: "OWNER",
    accessibleGroupIds: ["group-1"],
    groupAccesses: [],
    orgFilter: {
      type: "org",
      filter: { organisationId: "org-1" },
      filterNullable: { organisationId: "org-1" },
      organisationId: "org-1",
    },
  }),
  requireMutationRole: vi.fn(),
  requireTeamGroupAccess: vi.fn().mockResolvedValue(null),
  requirePlayerGroupAccess: vi.fn().mockResolvedValue(null),
}));

describe("updatePlayerCoreTeamAction — DecisionRecord audit trail (ARR-0022)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records a PLAYER_ASSIGNMENT/MOVE_PLAYER_TO_TEAM DecisionRecord with before/after snapshots", async () => {
    const { updatePlayerCoreTeamAction } = await import("../actions");

    mockDb.player.findFirst
      .mockResolvedValueOnce({ coreTeamId: "team-old" }) // previousPlayer lookup in actions.ts
      .mockResolvedValueOnce({ id: "player-1" }); // player-domain.ts's own existence check
    mockDb.team.findFirst.mockResolvedValueOnce({ id: "team-new" });
    mockDb.player.update.mockResolvedValueOnce({ id: "player-1", coreTeamId: "team-new" });
    mockDb.decisionRecord.create.mockResolvedValueOnce({ id: "decision-1", createdAt: new Date() });

    await updatePlayerCoreTeamAction("player-1", "team-new");

    expect(mockDb.decisionRecord.create).toHaveBeenCalledOnce();
    const callArgs = mockDb.decisionRecord.create.mock.calls[0][0];
    expect(callArgs.data.organisationId).toBe("org-1");
    expect(callArgs.data.decisionType).toBe("PLAYER_ASSIGNMENT");
    expect(callArgs.data.entityType).toBe("PLAYER");
    expect(callArgs.data.entityId).toBe("player-1");
    expect(callArgs.data.action).toBe("MOVE_PLAYER_TO_TEAM");
    expect(callArgs.data.beforeSnapshot).toEqual({ coreTeamId: "team-old" });
    expect(callArgs.data.afterSnapshot).toEqual({ coreTeamId: "team-new" });
  });

  it("records a null afterSnapshot when a player is unassigned from their core team", async () => {
    const { updatePlayerCoreTeamAction } = await import("../actions");

    mockDb.player.findFirst
      .mockResolvedValueOnce({ coreTeamId: "team-old" })
      .mockResolvedValueOnce({ id: "player-2" });
    mockDb.player.update.mockResolvedValueOnce({ id: "player-2", coreTeamId: null });
    mockDb.decisionRecord.create.mockResolvedValueOnce({ id: "decision-2", createdAt: new Date() });

    await updatePlayerCoreTeamAction("player-2", null);

    expect(mockDb.team.findFirst).not.toHaveBeenCalled();
    const callArgs = mockDb.decisionRecord.create.mock.calls[0][0];
    expect(callArgs.data.beforeSnapshot).toEqual({ coreTeamId: "team-old" });
    expect(callArgs.data.afterSnapshot).toEqual({ coreTeamId: null });
  });

  it("does not record a decision when the domain update fails", async () => {
    const { updatePlayerCoreTeamAction } = await import("../actions");

    mockDb.player.findFirst
      .mockResolvedValueOnce({ coreTeamId: "team-old" })
      .mockResolvedValueOnce(null); // player-domain.ts's existence check fails

    await expect(updatePlayerCoreTeamAction("missing-player", "team-new")).rejects.toThrow(
      "Player not found.",
    );
    expect(mockDb.decisionRecord.create).not.toHaveBeenCalled();
  });
});
