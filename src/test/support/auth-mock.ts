import { vi } from "vitest";

const {
  mockRequireActorContext,
  mockRequireMutationRole,
  mockRequireAdminRole,
  mockRequireOwnerRole,
  mockCanMutate,
  mockCanAdmin,
  mockCanOwn,
  mockHasTeamAccess,
  mockHasGroupAccess,
  mockRequireTeamAccess,
  mockRequirePlayerTeamAccess,
  mockRequireMatchTeamAccess,
  mockRequireTeamGroupAccess,
  mockRequireGroupAccessFromContext,
  mockTeamFilterFromContext,
  mockGroupFilterFromContext,
  mockTeamOrGroupFilter,
  mockWithActorContext,
  mockRequireCoachAccess,
} = vi.hoisted(() => ({
  mockRequireActorContext: vi.fn(),
  mockRequireMutationRole: vi.fn(),
  mockRequireAdminRole: vi.fn(),
  mockRequireOwnerRole: vi.fn(),
  mockCanMutate: vi.fn(),
  mockCanAdmin: vi.fn(),
  mockCanOwn: vi.fn(),
  mockHasTeamAccess: vi.fn(),
  mockHasGroupAccess: vi.fn(),
  mockRequireTeamAccess: vi.fn(),
  mockRequirePlayerTeamAccess: vi.fn(),
  mockRequireMatchTeamAccess: vi.fn(),
  mockRequireTeamGroupAccess: vi.fn(),
  mockRequireGroupAccessFromContext: vi.fn(),
  mockTeamFilterFromContext: vi.fn(),
  mockGroupFilterFromContext: vi.fn(),
  mockTeamOrGroupFilter: vi.fn(),
  mockWithActorContext: vi.fn(),
  mockRequireCoachAccess: vi.fn(),
}));

vi.mock("@/lib/auth/actor-context", () => ({
  requireActorContext: mockRequireActorContext,
  requireMutationRole: mockRequireMutationRole,
  requireAdminRole: mockRequireAdminRole,
  requireOwnerRole: mockRequireOwnerRole,
  canMutate: mockCanMutate,
  canAdmin: mockCanAdmin,
  canOwn: mockCanOwn,
  hasTeamAccess: mockHasTeamAccess,
  hasGroupAccess: mockHasGroupAccess,
  requireTeamAccess: mockRequireTeamAccess,
  requirePlayerTeamAccess: mockRequirePlayerTeamAccess,
  requireMatchTeamAccess: mockRequireMatchTeamAccess,
  requireTeamGroupAccess: mockRequireTeamGroupAccess,
  requireGroupAccessFromContext: mockRequireGroupAccessFromContext,
  teamFilterFromContext: mockTeamFilterFromContext,
  groupFilterFromContext: mockGroupFilterFromContext,
  teamOrGroupFilter: mockTeamOrGroupFilter,
  withActorContext: mockWithActorContext,
  MultipleMembershipsError: class MultipleMembershipsError extends Error {
    constructor(message?: string) {
      super(message ?? "Multiple memberships");
      this.name = "MultipleMembershipsError";
    }
  },
  AuthorizationError: class AuthorizationError extends Error {
    status: number;
    constructor(message?: string) {
      super(message ?? "Access denied");
      this.name = "AuthorizationError";
      this.status = 403;
    }
  },
}));

vi.mock("@/auth", () => ({
  handlers: vi.fn(),
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireCoachAccess: mockRequireCoachAccess,
  AuthorizationError: class AuthorizationError extends Error {
    status: number;
    constructor(message?: string) {
      super(message ?? "Access denied");
      this.name = "AuthorizationError";
      this.status = 403;
    }
  },
}));

vi.mock("next-auth", () => ({
  default: vi.fn().mockReturnValue({
    handlers: vi.fn(),
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/org-slug-cookie", () => ({
  getOrgSlugFromCookie: vi.fn().mockResolvedValue(undefined),
  ORG_SLUG_COOKIE: "org-slug",
}));

export type MockAuthOverrides = {
  userId?: string;
  email?: string;
  membershipId?: string;
  organisationId?: string;
  organisationSlug?: string;
  role?: "OWNER" | "ADMIN" | "COACH" | "VIEWER";
  accessibleGroupIds?: string[];
};

export function mockAuthContext(overrides?: MockAuthOverrides) {
  const defaults = {
    userId: "test-user-id",
    email: "test@example.com",
    membershipId: "test-membership-id",
    organisationId: "test-org-id",
    organisationSlug: "test-org",
    role: "ADMIN" as const,
    accessibleGroupIds: [] as string[],
    groupAccesses: [],
  };

  const context = { ...defaults, ...overrides };

  const orgFilter = {
    type: "org" as const,
    filter: { organisationId: context.organisationId },
    filterNullable: { organisationId: context.organisationId },
    organisationId: context.organisationId,
  };

  const actorContext = {
    userId: context.userId,
    email: context.email,
    membershipId: context.membershipId,
    organisationId: context.organisationId,
    organisationSlug: context.organisationSlug,
    role: context.role,
    accessibleGroupIds: context.accessibleGroupIds,
    groupAccesses: context.groupAccesses ?? [],
    orgFilter,
  };

  mockRequireActorContext.mockResolvedValue(actorContext);
  mockRequireCoachAccess.mockResolvedValue({
    id: context.userId,
    email: context.email,
  });
  mockRequireMutationRole.mockImplementation(() => {});
  mockRequireAdminRole.mockImplementation(() => {});
  mockRequireOwnerRole.mockImplementation(() => {});
  mockCanMutate.mockReturnValue(true);
  mockCanAdmin.mockReturnValue(true);
  mockCanOwn.mockReturnValue(false);
  mockHasTeamAccess.mockResolvedValue(true);
  mockHasGroupAccess.mockReturnValue(true);
  mockRequireTeamAccess.mockResolvedValue(undefined);
  mockRequirePlayerTeamAccess.mockResolvedValue(null);
  mockRequireMatchTeamAccess.mockResolvedValue(null);
  mockRequireTeamGroupAccess.mockResolvedValue(null);
  mockRequireGroupAccessFromContext.mockImplementation(() => {});
  mockTeamFilterFromContext.mockReturnValue(null);
  mockGroupFilterFromContext.mockReturnValue(null);
  mockTeamOrGroupFilter.mockReturnValue(null);
  mockWithActorContext.mockImplementation(async (_slug: string | undefined, fn: (ctx: typeof actorContext) => Promise<unknown>) => fn(actorContext));

  return {
    mockRequireActorContext,
    mockRequireMutationRole,
    mockRequireAdminRole,
    mockRequireOwnerRole,
    mockCanMutate,
    mockCanAdmin,
    mockCanOwn,
    mockHasTeamAccess,
    mockHasGroupAccess,
    mockRequireTeamAccess,
    mockRequirePlayerTeamAccess,
    mockRequireMatchTeamAccess,
    mockRequireTeamGroupAccess,
    mockRequireGroupAccessFromContext,
    mockTeamFilterFromContext,
    mockGroupFilterFromContext,
    mockTeamOrGroupFilter,
    mockWithActorContext,
    mockRequireCoachAccess,
    context,
    orgFilter,
    updateOrganisationId: (newOrgId: string) => {
      context.organisationId = newOrgId;
      const newOrgFilter = {
        type: "org" as const,
        filter: { organisationId: newOrgId },
        filterNullable: { organisationId: newOrgId },
        organisationId: newOrgId,
      };
      const newActorContext = {
        userId: context.userId,
        email: context.email,
        membershipId: context.membershipId,
        organisationId: newOrgId,
        organisationSlug: context.organisationSlug,
        role: context.role,
        accessibleGroupIds: context.accessibleGroupIds,
        groupAccesses: context.groupAccesses ?? [],
        orgFilter: newOrgFilter,
      };
      mockRequireActorContext.mockResolvedValue(newActorContext);
      mockRequireCoachAccess.mockResolvedValue({
        id: context.userId,
        email: context.email,
      });
      mockWithActorContext.mockImplementation(async (_slug: string | undefined, fn: (ctx: typeof newActorContext) => Promise<unknown>) => fn(newActorContext));
    },
  };
}

export type MockAuthResult = ReturnType<typeof mockAuthContext>;