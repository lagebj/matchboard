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

import {
  requireMutationRole,
  requireAdminRole,
  requireOwnerRole,
  canMutate,
  canAdmin,
  canOwn,
  hasTeamGroupAccess,
  requireTeamGroupAccess,
  requirePlayerGroupAccess,
  requireMatchGroupAccess,
  requireMatchGroupMutationRole,
  teamFilterFromContext,
  groupFilterFromContext,
  teamOrGroupFilter,
  type ActorContext,
} from "../actor-context";
import { AuthorizationError } from "@/lib/auth";
import type { GroupAccessEntry } from "@/lib/auth/group-context";

const ORG_ID = "org-test";
const ORG_SLUG = "test-org";

function makeContext(
  role: ActorContext["role"],
  accessibleGroupIds?: string[],
  groupAccesses?: GroupAccessEntry[],
): ActorContext {
  return {
    userId: "user-1",
    email: "coach@test.com",
    membershipId: "mem-1",
    organisationId: ORG_ID,
    organisationSlug: ORG_SLUG,
    role,
    accessibleGroupIds: accessibleGroupIds ?? [],
    // Defaulting each accessible group to GROUP_COACH keeps every pre-existing role-blind test
    // (which only ever passed accessibleGroupIds) exercising the same "has mutation access"
    // path they always did — only tests that care about the GROUP_VIEWER distinction need to
    // pass an explicit groupAccesses array.
    groupAccesses:
      groupAccesses ?? (accessibleGroupIds ?? []).map((footballGroupId) => ({ footballGroupId, role: "GROUP_COACH" as const })),
    orgFilter: { type: "org" as const, filter: { organisationId: ORG_ID }, filterNullable: { organisationId: ORG_ID }, organisationId: ORG_ID },
  };
}

vi.mock("@/lib/db", () => ({
  db: {
    player: {
      findFirst: vi.fn(),
    },
    match: {
      findFirst: vi.fn(),
    },
    team: {
      findFirst: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";

describe("requireMutationRole", () => {
  it("allows OWNER", () => {
    expect(() => requireMutationRole(makeContext("OWNER"))).not.toThrow();
  });

  it("allows ADMIN", () => {
    expect(() => requireMutationRole(makeContext("ADMIN"))).not.toThrow();
  });

  it("allows COACH", () => {
    expect(() => requireMutationRole(makeContext("COACH"))).not.toThrow();
  });

  it("rejects VIEWER", () => {
    expect(() => requireMutationRole(makeContext("VIEWER"))).toThrow(AuthorizationError);
  });

  it("rejects SUPPORT", () => {
    expect(() => requireMutationRole(makeContext("SUPPORT"))).toThrow(AuthorizationError);
  });

  it("error message includes role and allowed roles", () => {
    try {
      requireMutationRole(makeContext("VIEWER"));
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      expect(error.message).toContain("VIEWER");
      expect(error.message).toContain("OWNER");
      expect(error.message).toContain("ADMIN");
      expect(error.message).toContain("COACH");
    }
  });
});

describe("requireAdminRole", () => {
  it("allows OWNER", () => {
    expect(() => requireAdminRole(makeContext("OWNER"))).not.toThrow();
  });

  it("allows ADMIN", () => {
    expect(() => requireAdminRole(makeContext("ADMIN"))).not.toThrow();
  });

  it("rejects COACH", () => {
    expect(() => requireAdminRole(makeContext("COACH"))).toThrow(AuthorizationError);
  });

  it("rejects VIEWER", () => {
    expect(() => requireAdminRole(makeContext("VIEWER"))).toThrow(AuthorizationError);
  });

  it("rejects SUPPORT", () => {
    expect(() => requireAdminRole(makeContext("SUPPORT"))).toThrow(AuthorizationError);
  });
});

describe("requireOwnerRole", () => {
  it("allows OWNER", () => {
    expect(() => requireOwnerRole(makeContext("OWNER"))).not.toThrow();
  });

  it("rejects ADMIN", () => {
    expect(() => requireOwnerRole(makeContext("ADMIN"))).toThrow(AuthorizationError);
  });

  it("rejects COACH", () => {
    expect(() => requireOwnerRole(makeContext("COACH"))).toThrow(AuthorizationError);
  });
});

describe("canMutate", () => {
  it("returns true for OWNER", () => expect(canMutate(makeContext("OWNER"))).toBe(true));
  it("returns true for ADMIN", () => expect(canMutate(makeContext("ADMIN"))).toBe(true));
  it("returns true for COACH", () => expect(canMutate(makeContext("COACH"))).toBe(true));
  it("returns false for VIEWER", () => expect(canMutate(makeContext("VIEWER"))).toBe(false));
  it("returns false for SUPPORT", () => expect(canMutate(makeContext("SUPPORT"))).toBe(false));
});

describe("canAdmin", () => {
  it("returns true for OWNER", () => expect(canAdmin(makeContext("OWNER"))).toBe(true));
  it("returns true for ADMIN", () => expect(canAdmin(makeContext("ADMIN"))).toBe(true));
  it("returns false for COACH", () => expect(canAdmin(makeContext("COACH"))).toBe(false));
  it("returns false for VIEWER", () => expect(canAdmin(makeContext("VIEWER"))).toBe(false));
});

describe("canOwn", () => {
  it("returns true for OWNER only", () => {
    expect(canOwn(makeContext("OWNER"))).toBe(true);
    expect(canOwn(makeContext("ADMIN"))).toBe(false);
    expect(canOwn(makeContext("COACH"))).toBe(false);
    expect(canOwn(makeContext("VIEWER"))).toBe(false);
  });
});

describe("hasTeamGroupAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ADMIN has access to any team", async () => {
    expect(await hasTeamGroupAccess(makeContext("ADMIN"), "team-1")).toBe(true);
  });

  it("OWNER has access to any team", async () => {
    expect(await hasTeamGroupAccess(makeContext("OWNER"), "team-1")).toBe(true);
  });

  it("COACH with matching group access has access", async () => {
    (db.team.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "team-1",
      footballGroupId: "group-1",
    });
    expect(await hasTeamGroupAccess(makeContext("COACH", ["group-1"]), "team-1")).toBe(true);
  });

  it("COACH with non-matching group access is denied", async () => {
    (db.team.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "team-1",
      footballGroupId: "group-2",
    });
    expect(await hasTeamGroupAccess(makeContext("COACH", ["group-1"]), "team-1")).toBe(false);
  });

  it("COACH with no group access is denied", async () => {
    (db.team.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "team-1",
      footballGroupId: "group-1",
    });
    expect(await hasTeamGroupAccess(makeContext("COACH"), "team-1")).toBe(false);
  });

  it("returns false when team not found", async () => {
    (db.team.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect(await hasTeamGroupAccess(makeContext("COACH", ["group-1"]), "team-missing")).toBe(false);
  });
});

describe("requireTeamGroupAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows ADMIN to any team", async () => {
    await expect(requireTeamGroupAccess(makeContext("ADMIN"), "team-1")).resolves.toBeNull();
  });

  it("allows OWNER to any team", async () => {
    await expect(requireTeamGroupAccess(makeContext("OWNER"), "team-1")).resolves.toBeNull();
  });

  it("allows COACH with matching group access", async () => {
    (db.team.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "team-1",
      footballGroupId: "group-1",
    });
    await expect(requireTeamGroupAccess(makeContext("COACH", ["group-1"]), "team-1")).resolves.toBe("group-1");
  });

  it("rejects COACH with non-matching group access", async () => {
    (db.team.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "team-1",
      footballGroupId: "group-2",
    });
    await expect(requireTeamGroupAccess(makeContext("COACH", ["group-1"]), "team-1")).rejects.toThrow(AuthorizationError);
  });

  it("rejects COACH with no group access", async () => {
    (db.team.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "team-1",
      footballGroupId: "group-1",
    });
    await expect(requireTeamGroupAccess(makeContext("COACH"), "team-1")).rejects.toThrow(AuthorizationError);
  });
});

describe("requirePlayerGroupAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows ADMIN without checking player team", async () => {
    const ctx = makeContext("ADMIN");
    const result = await requirePlayerGroupAccess(ctx, "player-1");
    expect(result).toBeNull();
    expect(db.player.findFirst).not.toHaveBeenCalled();
  });

  it("allows OWNER without checking player team", async () => {
    const ctx = makeContext("OWNER");
    const result = await requirePlayerGroupAccess(ctx, "player-1");
    expect(result).toBeNull();
    expect(db.player.findFirst).not.toHaveBeenCalled();
  });

  it("allows COACH with group access to player's team", async () => {
    (db.player.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      coreTeamId: "team-1",
    });
    (db.team.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "team-1",
      footballGroupId: "group-1",
    });
    const ctx = makeContext("COACH", ["group-1", "group-2"]);
    const result = await requirePlayerGroupAccess(ctx, "player-1");
    expect(result).toBe("team-1");
  });

  it("rejects COACH without group access to player's team", async () => {
    (db.player.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      coreTeamId: "team-1",
    });
    (db.team.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "team-1",
      footballGroupId: "group-3",
    });
    const ctx = makeContext("COACH", ["group-1", "group-2"]);
    await expect(requirePlayerGroupAccess(ctx, "player-1")).rejects.toThrow(AuthorizationError);
  });

  it("rejects when player not found in org", async () => {
    (db.player.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const ctx = makeContext("COACH", ["group-1"]);
    await expect(requirePlayerGroupAccess(ctx, "player-missing")).rejects.toThrow(AuthorizationError);
  });

  it("allows COACH when player has no core team (coreTeamId is null)", async () => {
    (db.player.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      coreTeamId: null,
    });
    const ctx = makeContext("COACH", ["group-1"]);
    const result = await requirePlayerGroupAccess(ctx, "player-1");
    expect(result).toBeNull();
  });

  it("queries with org filter when org context", async () => {
    (db.player.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      coreTeamId: "team-1",
    });
    (db.team.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "team-1",
      footballGroupId: "group-1",
    });
    const ctx = makeContext("COACH", ["group-1"]);
    await requirePlayerGroupAccess(ctx, "player-1");
    expect(db.player.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "player-1",
          organisationId: ORG_ID,
        }),
      }),
    );
  });
});

describe("requireMatchGroupAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows ADMIN without checking match team", async () => {
    const ctx = makeContext("ADMIN");
    const result = await requireMatchGroupAccess(ctx, "match-1");
    expect(result).toBeNull();
    expect(db.match.findFirst).not.toHaveBeenCalled();
  });

  it("allows OWNER without checking match team", async () => {
    const ctx = makeContext("OWNER");
    const result = await requireMatchGroupAccess(ctx, "match-1");
    expect(result).toBeNull();
  });

  it("allows COACH with group access to match's team", async () => {
    (db.match.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      teamId: "team-1",
    });
    (db.team.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "team-1",
      footballGroupId: "group-1",
    });
    const ctx = makeContext("COACH", ["group-1", "group-2"]);
    const result = await requireMatchGroupAccess(ctx, "match-1");
    expect(result).toBe("team-1");
  });

  it("rejects COACH without group access to match's team", async () => {
    (db.match.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      teamId: "team-1",
    });
    (db.team.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "team-1",
      footballGroupId: "group-3",
    });
    const ctx = makeContext("COACH", ["group-1", "group-2"]);
    await expect(requireMatchGroupAccess(ctx, "match-1")).rejects.toThrow(AuthorizationError);
  });

  it("rejects when match not found in org", async () => {
    (db.match.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const ctx = makeContext("COACH", ["group-1"]);
    await expect(requireMatchGroupAccess(ctx, "match-missing")).rejects.toThrow(AuthorizationError);
  });

  it("allows COACH when match has no teamId (null)", async () => {
    (db.match.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      teamId: null,
    });
    const ctx = makeContext("COACH", ["group-1"]);
    const result = await requireMatchGroupAccess(ctx, "match-1");
    expect(result).toBeNull();
  });
});

describe("requireMatchGroupMutationRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows ADMIN without checking match team or group role", async () => {
    const ctx = makeContext("ADMIN");
    await expect(requireMatchGroupMutationRole(ctx, "match-1")).resolves.toBeUndefined();
    expect(db.match.findFirst).not.toHaveBeenCalled();
  });

  it("allows OWNER without checking match team or group role", async () => {
    const ctx = makeContext("OWNER");
    await expect(requireMatchGroupMutationRole(ctx, "match-1")).resolves.toBeUndefined();
  });

  it("allows a membership with GROUP_COACH role on the match's group", async () => {
    (db.match.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ teamId: "team-1" });
    (db.team.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ footballGroupId: "group-1" });
    const ctx = makeContext("COACH", ["group-1"], [{ footballGroupId: "group-1", role: "GROUP_COACH" }]);
    await expect(requireMatchGroupMutationRole(ctx, "match-1")).resolves.toBeUndefined();
  });

  it("rejects a membership with only GROUP_VIEWER role on the match's group, even with org role COACH", async () => {
    (db.match.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ teamId: "team-1" });
    (db.team.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ footballGroupId: "group-1" });
    const ctx = makeContext("COACH", ["group-1"], [{ footballGroupId: "group-1", role: "GROUP_VIEWER" }]);
    await expect(requireMatchGroupMutationRole(ctx, "match-1")).rejects.toThrow(AuthorizationError);
  });

  it("rejects a membership with GROUP_COACH on a different group than the match's", async () => {
    (db.match.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ teamId: "team-1" });
    (db.team.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ footballGroupId: "group-2" });
    const ctx = makeContext("COACH", ["group-1"], [{ footballGroupId: "group-1", role: "GROUP_COACH" }]);
    await expect(requireMatchGroupMutationRole(ctx, "match-1")).rejects.toThrow(AuthorizationError);
  });

  it("rejects when match not found in org", async () => {
    (db.match.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const ctx = makeContext("COACH", ["group-1"], [{ footballGroupId: "group-1", role: "GROUP_COACH" }]);
    await expect(requireMatchGroupMutationRole(ctx, "match-missing")).rejects.toThrow(AuthorizationError);
  });

  it("allows COACH when match has no teamId (null)", async () => {
    (db.match.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ teamId: null });
    const ctx = makeContext("COACH", ["group-1"], [{ footballGroupId: "group-1", role: "GROUP_VIEWER" }]);
    await expect(requireMatchGroupMutationRole(ctx, "match-1")).resolves.toBeUndefined();
  });
});

describe("requireTeamGroupAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows OWNER without checking team", async () => {
    const ctx = makeContext("OWNER");
    const result = await requireTeamGroupAccess(ctx, "team-1");
    expect(result).toBeNull();
    expect(db.team.findFirst).not.toHaveBeenCalled();
  });

  it("allows ADMIN without checking team", async () => {
    const ctx = makeContext("ADMIN");
    const result = await requireTeamGroupAccess(ctx, "team-1");
    expect(result).toBeNull();
    expect(db.team.findFirst).not.toHaveBeenCalled();
  });

  it("allows COACH with group access", async () => {
    (db.team.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "team-1",
      footballGroupId: "group-1",
    });
    const ctx = makeContext("COACH", ["group-1"]);
    const result = await requireTeamGroupAccess(ctx, "team-1");
    expect(result).toBe("group-1");
  });

  it("rejects COACH without group access", async () => {
    (db.team.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "team-1",
      footballGroupId: "group-2",
    });
    const ctx = makeContext("COACH", ["group-1"]);
    await expect(requireTeamGroupAccess(ctx, "team-1")).rejects.toThrow(AuthorizationError);
  });

  it("rejects when team not found in org", async () => {
    (db.team.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const ctx = makeContext("COACH", ["group-1"]);
    await expect(requireTeamGroupAccess(ctx, "team-missing")).rejects.toThrow(AuthorizationError);
  });

  it("rejects COACH with no group access at all", async () => {
    (db.team.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "team-1",
      footballGroupId: "group-1",
    });
    const ctx = makeContext("COACH");
    await expect(requireTeamGroupAccess(ctx, "team-1")).rejects.toThrow(AuthorizationError);
  });
});

describe("teamFilterFromContext", () => {
  it("returns null for OWNER", () => {
    expect(teamFilterFromContext(makeContext("OWNER"))).toBeNull();
  });

  it("returns null for ADMIN", () => {
    expect(teamFilterFromContext(makeContext("ADMIN"))).toBeNull();
  });

  it("returns footballGroupId in-filter for COACH with group access", () => {
    const ctx = makeContext("COACH", ["group-1", "group-2"]);
    expect(teamFilterFromContext(ctx)).toEqual({ footballGroupId: { in: ["group-1", "group-2"] } });
  });

  it("returns empty in-filter for COACH with no group access", () => {
    const ctx = makeContext("COACH");
    expect(teamFilterFromContext(ctx)).toEqual({ footballGroupId: { in: [] } });
  });
});

describe("groupFilterFromContext", () => {
  it("returns null for OWNER", () => {
    expect(groupFilterFromContext(makeContext("OWNER"))).toBeNull();
  });

  it("returns null for ADMIN", () => {
    expect(groupFilterFromContext(makeContext("ADMIN"))).toBeNull();
  });

  it("returns in-filter for COACH with group IDs", () => {
    const ctx = makeContext("COACH", ["group-1", "group-2"]);
    expect(groupFilterFromContext(ctx)).toEqual({ footballGroupId: { in: ["group-1", "group-2"] } });
  });

  it("returns empty in-filter for COACH with no groups", () => {
    const ctx = makeContext("COACH");
    expect(groupFilterFromContext(ctx)).toEqual({ footballGroupId: { in: [] } });
  });
});

describe("teamOrGroupFilter", () => {
  it("returns null for OWNER", () => {
    expect(teamOrGroupFilter(makeContext("OWNER"))).toBeNull();
  });

  it("returns null for ADMIN", () => {
    expect(teamOrGroupFilter(makeContext("ADMIN"))).toBeNull();
  });

  it("returns footballGroupId in-filter for COACH with group access", () => {
    const ctx = makeContext("COACH", ["group-1", "group-2"]);
    expect(teamOrGroupFilter(ctx)).toEqual({ footballGroupId: { in: ["group-1", "group-2"] } });
  });

  it("returns empty filter when COACH has no group access", () => {
    const ctx = makeContext("COACH");
    expect(teamOrGroupFilter(ctx)).toEqual({ footballGroupId: { in: [] } });
  });
});