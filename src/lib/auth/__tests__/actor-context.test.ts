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
  hasTeamAccess,
  requireTeamAccess,
  requirePlayerTeamAccess,
  requireMatchTeamAccess,
  requireTeamGroupAccess,
  teamFilterFromContext,
  groupFilterFromContext,
  teamOrGroupFilter,
  type ActorContext,
} from "../actor-context";
import { AuthorizationError } from "@/lib/auth";

const ORG_ID = "org-test";
const ORG_SLUG = "test-org";

function makeContext(role: ActorContext["role"], delegatedTeamIds?: string[] | null, accessibleGroupIds?: string[]): ActorContext {
  return {
    userId: "user-1",
    email: "coach@test.com",
    membershipId: "mem-1",
    organisationId: ORG_ID,
    organisationSlug: ORG_SLUG,
    role,
    delegatedTeamIds: delegatedTeamIds ?? null,
    accessibleGroupIds: accessibleGroupIds ?? [],
    groupAccesses: [],
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
    } catch (e: any) {
      expect(e.message).toContain("VIEWER");
      expect(e.message).toContain("OWNER");
      expect(e.message).toContain("ADMIN");
      expect(e.message).toContain("COACH");
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

describe("hasTeamAccess", () => {
  it("ADMIN has access to any team", () => {
    expect(hasTeamAccess(makeContext("ADMIN"), "team-1")).toBe(true);
  });

  it("OWNER has access to any team", () => {
    expect(hasTeamAccess(makeContext("OWNER"), "team-1")).toBe(true);
  });

  it("COACH with null delegatedTeamIds has access to any team", () => {
    expect(hasTeamAccess(makeContext("COACH", null), "team-1")).toBe(true);
  });

  it("COACH with matching delegatedTeamIds has access", () => {
    expect(hasTeamAccess(makeContext("COACH", ["team-1", "team-2"]), "team-1")).toBe(true);
  });

  it("COACH with non-matching delegatedTeamIds is denied", () => {
    expect(hasTeamAccess(makeContext("COACH", ["team-1", "team-2"]), "team-3")).toBe(false);
  });

  it("VIEWER with delegatedTeamIds respects delegation", () => {
    expect(hasTeamAccess(makeContext("VIEWER", ["team-1"]), "team-1")).toBe(true);
    expect(hasTeamAccess(makeContext("VIEWER", ["team-1"]), "team-2")).toBe(false);
  });
});

describe("requireTeamAccess", () => {
  it("allows ADMIN to any team", () => {
    expect(() => requireTeamAccess(makeContext("ADMIN"), "team-1")).not.toThrow();
  });

  it("allows OWNER to any team", () => {
    expect(() => requireTeamAccess(makeContext("OWNER"), "team-1")).not.toThrow();
  });

  it("allows COACH with null delegation", () => {
    expect(() => requireTeamAccess(makeContext("COACH", null), "team-1")).not.toThrow();
  });

  it("allows COACH with matching team", () => {
    expect(() => requireTeamAccess(makeContext("COACH", ["team-1"]), "team-1")).not.toThrow();
  });

  it("rejects COACH with non-matching team", () => {
    expect(() => requireTeamAccess(makeContext("COACH", ["team-1"]), "team-2")).toThrow(AuthorizationError);
  });
});

describe("requirePlayerTeamAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows ADMIN without checking player team", async () => {
    const ctx = makeContext("ADMIN");
    const result = await requirePlayerTeamAccess(ctx, "player-1");
    expect(result).toBeNull();
    expect(db.player.findFirst).not.toHaveBeenCalled();
  });

  it("allows OWNER without checking player team", async () => {
    const ctx = makeContext("OWNER");
    const result = await requirePlayerTeamAccess(ctx, "player-1");
    expect(result).toBeNull();
    expect(db.player.findFirst).not.toHaveBeenCalled();
  });

  it("allows COACH with null delegatedTeamIds without checking player team", async () => {
    const ctx = makeContext("COACH", null);
    const result = await requirePlayerTeamAccess(ctx, "player-1");
    expect(result).toBeNull();
    expect(db.player.findFirst).not.toHaveBeenCalled();
  });

  it("allows COACH with delegated access to player's team", async () => {
    (db.player.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      coreTeamId: "team-1",
    });
    const ctx = makeContext("COACH", ["team-1", "team-2"]);
    const result = await requirePlayerTeamAccess(ctx, "player-1");
    expect(result).toBe("team-1");
  });

  it("rejects COACH without delegated access to player's team", async () => {
    (db.player.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      coreTeamId: "team-3",
    });
    const ctx = makeContext("COACH", ["team-1", "team-2"]);
    await expect(requirePlayerTeamAccess(ctx, "player-1")).rejects.toThrow(AuthorizationError);
  });

  it("rejects when player not found in org", async () => {
    (db.player.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const ctx = makeContext("COACH", ["team-1"]);
    await expect(requirePlayerTeamAccess(ctx, "player-missing")).rejects.toThrow(AuthorizationError);
  });

  it("allows COACH when player has no core team (coreTeamId is null)", async () => {
    (db.player.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      coreTeamId: null,
    });
    const ctx = makeContext("COACH", ["team-1"]);
    const result = await requirePlayerTeamAccess(ctx, "player-1");
    expect(result).toBeNull();
  });

  it("queries with org filter when org context", async () => {
    (db.player.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      coreTeamId: "team-1",
    });
    const ctx = makeContext("COACH", ["team-1"]);
    await requirePlayerTeamAccess(ctx, "player-1");
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

describe("requireMatchTeamAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows ADMIN without checking match team", async () => {
    const ctx = makeContext("ADMIN");
    const result = await requireMatchTeamAccess(ctx, "match-1");
    expect(result).toBeNull();
    expect(db.match.findFirst).not.toHaveBeenCalled();
  });

  it("allows OWNER without checking match team", async () => {
    const ctx = makeContext("OWNER");
    const result = await requireMatchTeamAccess(ctx, "match-1");
    expect(result).toBeNull();
  });

  it("allows COACH with null delegatedTeamIds without checking match team", async () => {
    const ctx = makeContext("COACH", null);
    const result = await requireMatchTeamAccess(ctx, "match-1");
    expect(result).toBeNull();
    expect(db.match.findFirst).not.toHaveBeenCalled();
  });

  it("allows COACH with delegated access to match's team", async () => {
    (db.match.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      teamId: "team-1",
    });
    const ctx = makeContext("COACH", ["team-1", "team-2"]);
    const result = await requireMatchTeamAccess(ctx, "match-1");
    expect(result).toBe("team-1");
  });

  it("rejects COACH without delegated access to match's team", async () => {
    (db.match.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      teamId: "team-3",
    });
    const ctx = makeContext("COACH", ["team-1", "team-2"]);
    await expect(requireMatchTeamAccess(ctx, "match-1")).rejects.toThrow(AuthorizationError);
  });

  it("rejects when match not found in org", async () => {
    (db.match.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const ctx = makeContext("COACH", ["team-1"]);
    await expect(requireMatchTeamAccess(ctx, "match-missing")).rejects.toThrow(AuthorizationError);
  });

  it("allows COACH when match has no teamId (null)", async () => {
    (db.match.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      teamId: null,
    });
    const ctx = makeContext("COACH", ["team-1"]);
    const result = await requireMatchTeamAccess(ctx, "match-1");
    expect(result).toBeNull();
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

  it("allows COACH with team access (delegatedTeamIds)", async () => {
    (db.team.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "team-1",
      footballGroupId: null,
    });
    const ctx = makeContext("COACH", ["team-1", "team-2"]);
    const result = await requireTeamGroupAccess(ctx, "team-1");
    expect(result).toBeNull();
  });

  it("allows COACH with group access when no team access", async () => {
    (db.team.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "team-1",
      footballGroupId: "group-1",
    });
    const ctx = makeContext("COACH", ["team-2"], ["group-1"]);
    const result = await requireTeamGroupAccess(ctx, "team-1");
    expect(result).toBe("group-1");
  });

  it("allows COACH with team access even without group access", async () => {
    (db.team.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "team-1",
      footballGroupId: "group-1",
    });
    const ctx = makeContext("COACH", ["team-1"], []);
    const result = await requireTeamGroupAccess(ctx, "team-1");
    expect(result).toBe("group-1");
  });

  it("rejects COACH with neither team nor group access", async () => {
    (db.team.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "team-1",
      footballGroupId: "group-1",
    });
    const ctx = makeContext("COACH", ["team-2"], ["group-2"]);
    await expect(requireTeamGroupAccess(ctx, "team-1")).rejects.toThrow(AuthorizationError);
  });

  it("rejects when team not found in org", async () => {
    (db.team.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const ctx = makeContext("COACH", ["team-1"]);
    await expect(requireTeamGroupAccess(ctx, "team-missing")).rejects.toThrow(AuthorizationError);
  });

  it("allows COACH with null delegatedTeamIds without checking team", async () => {
    const ctx = makeContext("COACH", null);
    const result = await requireTeamGroupAccess(ctx, "team-1");
    expect(result).toBeNull();
    expect(db.team.findFirst).not.toHaveBeenCalled();
  });
});

describe("teamFilterFromContext", () => {
  it("returns null for OWNER", () => {
    expect(teamFilterFromContext(makeContext("OWNER"))).toBeNull();
  });

  it("returns null for ADMIN", () => {
    expect(teamFilterFromContext(makeContext("ADMIN"))).toBeNull();
  });

  it("returns null for COACH with null delegatedTeamIds", () => {
    expect(teamFilterFromContext(makeContext("COACH", null))).toBeNull();
  });

  it("returns in-filter for COACH with delegated team IDs", () => {
    const ctx = makeContext("COACH", ["team-1", "team-2"]);
    expect(teamFilterFromContext(ctx)).toEqual({ teamId: { in: ["team-1", "team-2"] } });
  });
});

describe("groupFilterFromContext", () => {
  it("returns null for OWNER", () => {
    expect(groupFilterFromContext(makeContext("OWNER"))).toBeNull();
  });

  it("returns null for ADMIN", () => {
    expect(groupFilterFromContext(makeContext("ADMIN"))).toBeNull();
  });

  it("returns empty in-filter for COACH with no groups", () => {
    const ctx = makeContext("COACH", ["team-1"]);
    expect(groupFilterFromContext(ctx)).toEqual({ footballGroupId: { in: [] } });
  });

  it("returns in-filter for COACH with group IDs", () => {
    const ctx = makeContext("COACH", ["team-1"], ["group-1", "group-2"]);
    expect(groupFilterFromContext(ctx)).toEqual({ footballGroupId: { in: ["group-1", "group-2"] } });
  });
});

describe("teamOrGroupFilter", () => {
  it("returns null for OWNER", () => {
    expect(teamOrGroupFilter(makeContext("OWNER"))).toBeNull();
  });

  it("returns null for ADMIN", () => {
    expect(teamOrGroupFilter(makeContext("ADMIN"))).toBeNull();
  });

  it("returns null for COACH with null delegatedTeamIds", () => {
    expect(teamOrGroupFilter(makeContext("COACH", null))).toBeNull();
  });

  it("returns team-only OR filter when no group access", () => {
    const ctx = makeContext("COACH", ["team-1", "team-2"]);
    expect(teamOrGroupFilter(ctx)).toEqual({ OR: [{ teamId: { in: ["team-1", "team-2"] } }] });
  });

  it("returns group-only OR filter when no team access but group access", () => {
    const ctx = makeContext("COACH", [], ["group-1"]);
    expect(teamOrGroupFilter(ctx)).toEqual({ OR: [{ footballGroupId: { in: ["group-1"] } }] });
  });

  it("returns both team and group OR filter when both are present", () => {
    const ctx = makeContext("COACH", ["team-1"], ["group-1"]);
    expect(teamOrGroupFilter(ctx)).toEqual({ OR: [{ teamId: { in: ["team-1"] } }, { footballGroupId: { in: ["group-1"] } }] });
  });

  it("returns empty filter when COACH has no team or group access", () => {
    const ctx = makeContext("COACH", []);
    expect(teamOrGroupFilter(ctx)).toEqual({ OR: [{ teamId: { in: [] } }] });
  });
});