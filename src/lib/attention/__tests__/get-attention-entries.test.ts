import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRequireActorContext, mockCanAdmin, mockHasTeamAccess, mocks, mockDb } = vi.hoisted(() => {
  const mockRequireActorContext = vi.fn();
  const mockCanAdmin = vi.fn();
  const mockHasTeamAccess = vi.fn();
  const mocks = {
    membershipFindFirst: vi.fn(),
    membershipFindMany: vi.fn(),
    reviewFindMany: vi.fn(),
    invitationFindMany: vi.fn(),
    supportFindMany: vi.fn(),
    leagueSeasonFindFirst: vi.fn(),
    postMatchReportFindMany: vi.fn(),
    matchFindMany: vi.fn(),
    workOwnershipFindMany: vi.fn(),
  };
  const mockDb = {
    organisationMembership: { findFirst: mocks.membershipFindFirst, findMany: mocks.membershipFindMany },
    reviewRequest: { findMany: mocks.reviewFindMany },
    organisationInvitation: { findMany: mocks.invitationFindMany },
    organisation: {},
    postMatchReport: { findMany: mocks.postMatchReportFindMany },
    match: { findMany: mocks.matchFindMany },
    workOwnership: { findMany: mocks.workOwnershipFindMany },
    leagueSeason: { findFirst: mocks.leagueSeasonFindFirst },
  };
  return { mockRequireActorContext, mockCanAdmin, mockHasTeamAccess, mocks, mockDb };
});

vi.mock("@/lib/auth/actor-context", () => ({
  requireActorContext: mockRequireActorContext,
  canAdmin: mockCanAdmin,
  hasTeamGroupAccess: mockHasTeamAccess,
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

vi.mock("@/lib/organisations/organisation-resolver", () => ({
  resolveOrganisationAccess: vi.fn(),
}));

import { getAttentionEntries } from "@/lib/attention/get-attention-entries";

const ADMIN_CTX = {
  userId: "user-1",
  email: "admin@test.com",
  membershipId: "mem-1",
  organisationId: "org-1",
  organisationSlug: "test-org",
  role: "ADMIN" as const,
  orgFilter: { type: "org" as const, filter: { organisationId: "org-1" }, filterNullable: { organisationId: "org-1" }, organisationId: "org-1" },
};

const COACH_CTX = {
  userId: "user-2",
  email: "coach@test.com",
  membershipId: "mem-2",
  organisationId: "org-1",
  organisationSlug: "test-org",
  role: "COACH" as const,
  orgFilter: { type: "org" as const, filter: { organisationId: "org-1" }, filterNullable: { organisationId: "org-1" }, organisationId: "org-1" },
};

const DELEGATED_COACH_CTX = {
  userId: "user-3",
  email: "delegated@test.com",
  membershipId: "mem-3",
  organisationId: "org-1",
  organisationSlug: "test-org",
  role: "COACH" as const,
  orgFilter: { type: "org" as const, filter: { organisationId: "org-1" }, filterNullable: { organisationId: "org-1" }, organisationId: "org-1" },
};

describe("getAttentionEntries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireActorContext.mockResolvedValue(ADMIN_CTX);
    mockCanAdmin.mockReturnValue(true);
    mocks.membershipFindFirst.mockResolvedValue({ id: "mem-1", userId: "user-1", organisationId: "org-1", role: "ADMIN" });
    mocks.reviewFindMany.mockResolvedValue([]);
    mocks.invitationFindMany.mockResolvedValue([]);
    mocks.membershipFindMany.mockResolvedValue([]);
    mocks.leagueSeasonFindFirst.mockResolvedValue(null);
    mocks.postMatchReportFindMany.mockResolvedValue([]);
    mocks.matchFindMany.mockResolvedValue([]);
    mocks.workOwnershipFindMany.mockResolvedValue([]);
  });

  it("returns empty array for non-org context", async () => {
    mockRequireActorContext.mockResolvedValue({
      ...ADMIN_CTX,
      orgFilter: { type: "all" as const },
    });

    const result = await getAttentionEntries("test-org");

    expect(result).toEqual([]);
  });

  it("returns empty array when user has no membership in the org", async () => {
    mocks.membershipFindFirst.mockResolvedValue(null);

    const result = await getAttentionEntries("test-org");

    expect(result).toEqual([]);
  });

  it("includes invitation_pending entries for admin users", async () => {
    const tomorrow = new Date(Date.now() + 86400000);
    mocks.invitationFindMany.mockResolvedValue([
      { id: "inv-1", invitedEmail: "newcoach@test.com", intendedRole: "COACH", status: "PENDING", expiresAt: tomorrow, organisationId: "org-1" },
    ]);

    const result = await getAttentionEntries("test-org");

    const invitations = result.filter((e) => e.category === "invitation_pending");
    expect(invitations).toHaveLength(1);
    expect(invitations[0].title).toContain("Pending invitation");
  });

  it("excludes invitation_pending entries for non-admin users", async () => {
    mockRequireActorContext.mockResolvedValue(COACH_CTX);
    mockCanAdmin.mockReturnValue(false);
    mocks.membershipFindFirst.mockResolvedValue({ id: "mem-2", userId: "user-2", organisationId: "org-1", role: "COACH" });

    const result = await getAttentionEntries("test-org");

    const invitations = result.filter((e) => e.category === "invitation_pending");
    expect(invitations).toHaveLength(0);
  });

  it("includes expiring_support_access entries for admin users", async () => {
    const nextWeek = new Date(Date.now() + 5 * 86400000);
    mocks.membershipFindMany.mockResolvedValue([
      { id: "mem-s1", userId: "user-s1", organisationId: "org-1", role: "SUPPORT", expiresAt: nextWeek, user: { name: "Support User" } },
    ]);

    const result = await getAttentionEntries("test-org");

    const expiring = result.filter((e) => e.category === "expiring_support_access");
    expect(expiring).toHaveLength(1);
    expect(expiring[0].title).toContain("Expiring SUPPORT");
  });

  it("excludes expiring_support_access entries for non-admin users", async () => {
    mockRequireActorContext.mockResolvedValue(COACH_CTX);
    mockCanAdmin.mockReturnValue(false);
    mocks.membershipFindFirst.mockResolvedValue({ id: "mem-2", userId: "user-2", organisationId: "org-1", role: "COACH" });

    const result = await getAttentionEntries("test-org");

    const expiring = result.filter((e) => e.category === "expiring_support_access");
    expect(expiring).toHaveLength(0);
  });

  it("includes review_assigned entries for the current user", async () => {
    mocks.reviewFindMany
      .mockResolvedValueOnce([
        { id: "rev-1", targetType: "EVENT_SQUAD", targetId: "squad-1", requestMessage: "Please review", reviewerComment: null, createdAt: new Date() },
      ])
      .mockResolvedValueOnce([]);

    const result = await getAttentionEntries("test-org");

    const reviews = result.filter((e) => e.category === "review_assigned");
    expect(reviews).toHaveLength(1);
    expect(reviews[0].sourceType).toBe("review_request");
  });

  it("includes unacknowledged_handover entries for the current user", async () => {
    mocks.workOwnershipFindMany.mockResolvedValue([
      { id: "own-1", targetType: "EVENT", targetId: "event-1", handoverNote: "Please take over", dueAt: null, createdAt: new Date() },
    ]);

    const result = await getAttentionEntries("test-org");

    const handovers = result.filter((e) => e.category === "unacknowledged_handover");
    expect(handovers).toHaveLength(1);
    expect(handovers[0].title).toContain("Handover");
  });

  it("sorts entries by urgency (HIGH first, then NORMAL, then LOW)", async () => {
    const tomorrow = new Date(Date.now() + 86400000);
    mocks.reviewFindMany
      .mockResolvedValueOnce([
        { id: "rev-1", targetType: "EVENT_SQUAD", targetId: "squad-1", requestMessage: null, reviewerComment: null, createdAt: new Date() },
      ])
      .mockResolvedValueOnce([]);
    mocks.invitationFindMany.mockResolvedValue([
      { id: "inv-1", invitedEmail: "new@test.com", intendedRole: "COACH", status: "PENDING", expiresAt: tomorrow, organisationId: "org-1" },
    ]);

    const result = await getAttentionEntries("test-org");

    const urgencies = result.map((e) => e.urgency);
    const highIdx = urgencies.indexOf("HIGH");
    const normalIdx = urgencies.indexOf("NORMAL");
    const lowIdx = urgencies.indexOf("LOW");

    if (highIdx >= 0 && normalIdx >= 0) expect(highIdx).toBeLessThan(normalIdx);
    if (normalIdx >= 0 && lowIdx >= 0) expect(normalIdx).toBeLessThan(lowIdx);
  });

  describe("team-scoped filtering for delegated coaches", () => {
    it("filters missing post-match report entries by team access for delegated coaches", async () => {
      mockRequireActorContext.mockResolvedValue(DELEGATED_COACH_CTX);
      mockCanAdmin.mockReturnValue(false);
      mockHasTeamAccess.mockImplementation((_ctx: unknown, teamId: string) => teamId === "team-A");
      mocks.membershipFindFirst.mockResolvedValue({ id: "mem-3", userId: "user-3", organisationId: "org-1", role: "COACH" });
      mocks.leagueSeasonFindFirst.mockResolvedValue({ id: "ls-1" });
      mocks.postMatchReportFindMany.mockResolvedValue([]);
      mocks.matchFindMany.mockResolvedValue([
        { id: "match-1", opponent: "Team X", homeAway: "HOME", startsAt: new Date("2026-01-01"), teamId: "team-A" },
        { id: "match-2", opponent: "Team Y", homeAway: "AWAY", startsAt: new Date("2026-01-01"), teamId: "team-B" },
        { id: "match-3", opponent: "Team Z", homeAway: "HOME", startsAt: new Date("2026-01-01"), teamId: null },
      ]);

      const result = await getAttentionEntries("test-org");

      const missingReports = result.filter((e) => e.category === "missing_post_match_report");
      const matchIds = missingReports.map((e) => e.sourceId);
      expect(matchIds).toContain("match-1");
      expect(matchIds).not.toContain("match-2");
      expect(matchIds).toContain("match-3");
    });

    it("filters unowned fixture entries by team access for delegated coaches", async () => {
      mockRequireActorContext.mockResolvedValue(DELEGATED_COACH_CTX);
      mockCanAdmin.mockReturnValue(false);
      mockHasTeamAccess.mockImplementation((_ctx: unknown, teamId: string) => teamId === "team-A");
      mocks.membershipFindFirst.mockResolvedValue({ id: "mem-3", userId: "user-3", organisationId: "org-1", role: "COACH" });
      mocks.leagueSeasonFindFirst.mockResolvedValue({ id: "ls-1" });
      mocks.workOwnershipFindMany.mockResolvedValue([]);
      const upcomingDate = new Date(Date.now() + 2 * 86400000);
      mocks.matchFindMany.mockResolvedValue([
        { id: "match-1", opponent: "Team X", startsAt: upcomingDate, teamId: "team-A" },
        { id: "match-2", opponent: "Team Y", startsAt: upcomingDate, teamId: "team-B" },
      ]);

      const result = await getAttentionEntries("test-org");

      const unowned = result.filter((e) => e.category === "unowned_fixture");
      const matchIds = unowned.map((e) => e.sourceId);
      expect(matchIds).toContain("match-1");
      expect(matchIds).not.toContain("match-2");
    });

    it("shows all entries for unrestricted coaches", async () => {
      mockRequireActorContext.mockResolvedValue(COACH_CTX);
      mockCanAdmin.mockReturnValue(false);
      mockHasTeamAccess.mockReturnValue(true);
      mocks.membershipFindFirst.mockResolvedValue({ id: "mem-2", userId: "user-2", organisationId: "org-1", role: "COACH" });
      mocks.leagueSeasonFindFirst.mockResolvedValue({ id: "ls-1" });
      mocks.postMatchReportFindMany.mockResolvedValue([]);
      const pastDate = new Date("2026-01-01");
      mocks.matchFindMany.mockResolvedValue([
        { id: "match-1", opponent: "Team X", homeAway: "HOME", startsAt: pastDate, teamId: "team-A" },
        { id: "match-2", opponent: "Team Y", homeAway: "AWAY", startsAt: pastDate, teamId: "team-B" },
      ]);

      const result = await getAttentionEntries("test-org");

      const missingReports = result.filter((e) => e.category === "missing_post_match_report");
      expect(missingReports).toHaveLength(2);
    });
  });
});