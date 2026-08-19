import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    organisationMembership: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/tenancy/tenant-async-storage", () => ({
  setTenantUserId: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { getOrgSlugForUser, resolveOrgSlugForLayout } from "../resolve-org-slug";

function membership(overrides: {
  organisationId?: string;
  slug?: string;
  suspendedAt?: Date | null;
  role?: string;
  expiresAt?: Date | null;
}) {
  return {
    organisationId: overrides.organisationId ?? "org-1",
    role: overrides.role ?? "COACH",
    expiresAt: overrides.expiresAt ?? null,
    organisation: {
      id: overrides.organisationId ?? "org-1",
      slug: overrides.slug ?? "org-1-slug",
      suspendedAt: overrides.suspendedAt ?? null,
    },
  };
}

describe("getOrgSlugForUser", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.mocked(db.organisationMembership.findMany).mockReset();
  });

  it("returns null when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    expect(await getOrgSlugForUser()).toBeNull();
    expect(db.organisationMembership.findMany).not.toHaveBeenCalled();
  });

  it("returns null when the user has zero eligible memberships", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(db.organisationMembership.findMany).mockResolvedValue([] as never);

    expect(await getOrgSlugForUser()).toBeNull();
  });

  it("returns the slug when exactly one eligible membership exists", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(db.organisationMembership.findMany).mockResolvedValue([
      membership({ slug: "only-org" }),
    ] as never);

    expect(await getOrgSlugForUser()).toBe("only-org");
  });

  it("returns null when the user belongs to more than one eligible organisation (ambiguous)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(db.organisationMembership.findMany).mockResolvedValue([
      membership({ organisationId: "org-1", slug: "org-1-slug" }),
      membership({ organisationId: "org-2", slug: "org-2-slug" }),
    ] as never);

    expect(await getOrgSlugForUser()).toBeNull();
  });

  it("excludes memberships in a suspended organisation", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(db.organisationMembership.findMany).mockResolvedValue([
      membership({ organisationId: "org-1", slug: "org-1-slug", suspendedAt: new Date() }),
    ] as never);

    expect(await getOrgSlugForUser()).toBeNull();
  });

  it("excludes an expired SUPPORT-role membership", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(db.organisationMembership.findMany).mockResolvedValue([
      membership({
        organisationId: "org-1",
        slug: "org-1-slug",
        role: "SUPPORT",
        expiresAt: new Date(Date.now() - 1000),
      }),
    ] as never);

    expect(await getOrgSlugForUser()).toBeNull();
  });
});

describe("resolveOrgSlugForLayout", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.mocked(db.organisationMembership.findMany).mockReset();
    vi.mocked(redirect).mockClear();
  });

  it("returns the slug directly when exactly one org resolves", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(db.organisationMembership.findMany).mockResolvedValue([
      membership({ slug: "only-org" }),
    ] as never);

    expect(await resolveOrgSlugForLayout()).toBe("only-org");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects to /organisations when no org resolves (zero memberships)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(db.organisationMembership.findMany).mockResolvedValue([] as never);

    await expect(resolveOrgSlugForLayout()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/organisations");
  });

  it("redirects to /organisations when the org is ambiguous (multiple memberships)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(db.organisationMembership.findMany).mockResolvedValue([
      membership({ organisationId: "org-1", slug: "org-1-slug" }),
      membership({ organisationId: "org-2", slug: "org-2-slug" }),
    ] as never);

    await expect(resolveOrgSlugForLayout()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/organisations");
  });
});
