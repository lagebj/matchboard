import { vi } from "vitest";

const {
  mockRequireActorContext,
  mockRequireMutationRole,
  mockRequireAdminRole,
  mockRequireOwnerRole,
  mockCanMutate,
  mockCanAdmin,
  mockCanOwn,
  mockHasTeamGroupAccess,
  mockHasGroupAccess,
  mockRequireTeamGroupAccess,
  mockRequirePlayerGroupAccess,
  mockRequireMatchGroupAccess,
  mockRequireGroupAccessFromContext,
  mockTeamFilterFromContext,
  mockGroupFilterFromContext,
  mockTeamOrGroupFilter,
  mockRequireCoachAccess,
} = vi.hoisted(() => ({
  mockRequireActorContext: vi.fn(),
  mockRequireMutationRole: vi.fn(),
  mockRequireAdminRole: vi.fn(),
  mockRequireOwnerRole: vi.fn(),
  mockCanMutate: vi.fn(),
  mockCanAdmin: vi.fn(),
  mockCanOwn: vi.fn(),
  mockHasTeamGroupAccess: vi.fn(),
  mockHasGroupAccess: vi.fn(),
  mockRequireTeamGroupAccess: vi.fn(),
  mockRequirePlayerGroupAccess: vi.fn(),
  mockRequireMatchGroupAccess: vi.fn(),
  mockRequireGroupAccessFromContext: vi.fn(),
  mockTeamFilterFromContext: vi.fn(),
  mockGroupFilterFromContext: vi.fn(),
  mockTeamOrGroupFilter: vi.fn(),
  mockRequireCoachAccess: vi.fn(),
}));

vi.mock("@/lib/auth/actor-context", () => ({
  requireActorContext: mockRequireActorContext,
  // Page/action code calls requirePageActorContext (ADR-0082); tests don't need to distinguish
  // it from requireActorContext's success path — same mock, so mockAuthContext()'s existing
  // mockRequireActorContext.mockResolvedValue(...) drives both transparently.
  requirePageActorContext: mockRequireActorContext,
  requireMutationRole: mockRequireMutationRole,
  requireAdminRole: mockRequireAdminRole,
  requireOwnerRole: mockRequireOwnerRole,
  canMutate: mockCanMutate,
  canAdmin: mockCanAdmin,
  canOwn: mockCanOwn,
  hasTeamGroupAccess: mockHasTeamGroupAccess,
  hasGroupAccess: mockHasGroupAccess,
  requireTeamGroupAccess: mockRequireTeamGroupAccess,
  requirePlayerGroupAccess: mockRequirePlayerGroupAccess,
  requireMatchGroupAccess: mockRequireMatchGroupAccess,
  requireGroupAccessFromContext: mockRequireGroupAccessFromContext,
  teamFilterFromContext: mockTeamFilterFromContext,
  groupFilterFromContext: mockGroupFilterFromContext,
  teamOrGroupFilter: mockTeamOrGroupFilter,
  requireCoachAccess: mockRequireCoachAccess,
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
    get filter() { return { organisationId: context.organisationId }; },
    get filterNullable() { return { organisationId: context.organisationId }; },
    get organisationId() { return context.organisationId; },
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
  mockHasTeamGroupAccess.mockResolvedValue(true);
  mockHasGroupAccess.mockReturnValue(true);
  mockRequireTeamGroupAccess.mockResolvedValue(undefined);
  mockRequirePlayerGroupAccess.mockResolvedValue(null);
  mockRequireMatchGroupAccess.mockResolvedValue(null);
  mockRequireTeamGroupAccess.mockResolvedValue(null);
  mockRequireGroupAccessFromContext.mockImplementation(() => {});
  mockTeamFilterFromContext.mockReturnValue(null);
  mockGroupFilterFromContext.mockReturnValue(null);
  mockTeamOrGroupFilter.mockReturnValue(null);

  return {
    mockRequireActorContext,
    mockRequireMutationRole,
    mockRequireAdminRole,
    mockRequireOwnerRole,
    mockCanMutate,
    mockCanAdmin,
    mockCanOwn,
    mockHasTeamGroupAccess,
    mockHasGroupAccess,
    mockRequireTeamGroupAccess,
    mockRequirePlayerGroupAccess,
    mockRequireMatchGroupAccess,
    mockRequireGroupAccessFromContext,
    mockTeamFilterFromContext,
    mockGroupFilterFromContext,
    mockTeamOrGroupFilter,
    mockRequireCoachAccess,
    context,
    orgFilter,
    updateOrganisationId: (newOrgId: string) => {
      context.organisationId = newOrgId;
      const newActorContext = {
        userId: context.userId,
        email: context.email,
        membershipId: context.membershipId,
        organisationId: newOrgId,
        organisationSlug: context.organisationSlug,
        role: context.role,
        accessibleGroupIds: context.accessibleGroupIds,
        groupAccesses: context.groupAccesses ?? [],
        orgFilter,
      };
      mockRequireActorContext.mockResolvedValue(newActorContext);
      mockRequireCoachAccess.mockResolvedValue({
        id: context.userId,
        email: context.email,
      });
    },
  };
}

export type MockAuthResult = ReturnType<typeof mockAuthContext>;