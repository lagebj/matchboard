import { vi } from "vitest";

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

  const { mockRequireActorContext, mockRequireMutationRole } = vi.hoisted(() => ({
    mockRequireActorContext: vi.fn(),
    mockRequireMutationRole: vi.fn(),
  }));

  const { mockRequireCoachAccess } = vi.hoisted(() => ({
    mockRequireCoachAccess: vi.fn(),
  }));

  mockRequireActorContext.mockResolvedValue({
    userId: context.userId,
    email: context.email,
    membershipId: context.membershipId,
    organisationId: context.organisationId,
    organisationSlug: context.organisationSlug,
    role: context.role,
    accessibleGroupIds: context.accessibleGroupIds,
    groupAccesses: [],
    orgFilter: {
      type: "org",
      filter: { organisationId: context.organisationId },
      filterNullable: { organisationId: context.organisationId },
      organisationId: context.organisationId,
    },
  });

  mockRequireCoachAccess.mockResolvedValue({
    id: context.userId,
    email: context.email,
  });

  mockRequireMutationRole.mockImplementation(() => {});

  vi.mock("@/lib/auth/actor-context", () => ({
    requireActorContext: mockRequireActorContext,
    requireMutationRole: mockRequireMutationRole,
  }));

  vi.mock("@/lib/auth", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/auth")>();
    return {
      ...actual,
      requireCoachAccess: mockRequireCoachAccess,
    };
  });

  vi.mock("next-auth", () => ({
    default: vi.fn(),
  }));

  vi.mock("next-auth/react", () => ({
    SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  }));

  vi.mock("next/headers", () => ({
    cookies: vi.fn(),
    headers: vi.fn(),
  }));

  vi.mock("@/lib/auth/org-slug-cookie", () => ({
    getOrgSlugFromCookie: vi.fn().mockResolvedValue(undefined),
    ORG_SLUG_COOKIE: "org-slug",
  }));

  return {
    mockRequireActorContext,
    mockRequireMutationRole,
    mockRequireCoachAccess,
    context,
  };
}

export type MockAuthResult = ReturnType<typeof mockAuthContext>;