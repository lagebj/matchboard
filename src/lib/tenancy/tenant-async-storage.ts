import { AsyncLocalStorage } from "async_hooks";

export type TenantContextStorage = {
  organisationId: string;
  userId?: string;
};

type SystemPrivilegeStorage = {
  reason: string;
};

// ARR-0029 "Bug 3": Turbopack's per-route code splitting inlines this module's small exported
// functions (setTenantOrganisationId() etc.) into dozens of separate route/page/action chunks
// rather than having them all import one shared module instance — confirmed by inspecting the
// production build output (`getTenantOrganisationId`, used only from src/lib/db.ts, appeared in
// 3 chunks; `setTenantOrganisationId`, called from ~80 different call sites across the app,
// appeared in ~80 chunks). Each duplicated copy evaluating `new AsyncLocalStorage()` at its own
// module scope creates a genuinely separate store — a write via one chunk's copy is invisible to
// a read via another chunk's copy, deterministically breaking tenant scoping for whichever
// specific routes' chunks didn't happen to end up sharing the same copy as src/lib/db.ts's
// extension. Anchoring both AsyncLocalStorage instances on `globalThis` (the same
// survive-module-re-evaluation pattern src/lib/db.ts already uses for its Prisma client, applied
// here unconditionally rather than dev-only, since the goal is cross-chunk consistency *within
// one running process*, not just surviving dev hot-reload) guarantees every duplicated copy of
// this module resolves to the exact same store, regardless of how many chunks the bundler split
// it into.
const globalForTenancy = globalThis as unknown as {
  tenantAsyncStorage: AsyncLocalStorage<TenantContextStorage> | undefined;
  systemPrivilegeStorage: AsyncLocalStorage<SystemPrivilegeStorage> | undefined;
};

export const tenantAsyncStorage =
  globalForTenancy.tenantAsyncStorage ?? new AsyncLocalStorage<TenantContextStorage>();
globalForTenancy.tenantAsyncStorage = tenantAsyncStorage;

/**
 * A distinct AsyncLocalStorage channel (not merged into tenantAsyncStorage) for the narrow,
 * explicit escape hatch the `tenantRLS` extension (src/lib/db.ts) checks before refusing an
 * unscoped query on an RLS-scoped model. Keeping it separate from tenant context means a system
 * caller can never accidentally "look like" a real organisation (empty/placeholder orgId), and
 * grepping `runWithSystemPrivilege` finds every intentionally-unscoped call site in the repo.
 */
const systemPrivilegeStorage =
  globalForTenancy.systemPrivilegeStorage ?? new AsyncLocalStorage<SystemPrivilegeStorage>();
globalForTenancy.systemPrivilegeStorage = systemPrivilegeStorage;

export function getSystemPrivilegeReason(): string | undefined {
  return systemPrivilegeStorage.getStore()?.reason;
}

/**
 * Explicit opt-in for a genuinely privileged/system operation that must query an RLS-scoped
 * model without ordinary tenant organisation context (e.g. a signed Worker->Vercel internal
 * endpoint with no user session, or a one-off maintainer script run before any organisation
 * exists). `reason` is required and shows up in [RLS] debug logs — pass a short, specific,
 * greppable string identifying the caller, not a generic phrase. Do not wrap ordinary
 * request/action handling in this; use `requireActorContext()` /
 * `runWithTenantOrganisationId()` instead. See ADR-0087.
 */
export function runWithSystemPrivilege<T>(reason: string, fn: () => Promise<T>): Promise<T> {
  if (!reason.trim()) {
    throw new Error("runWithSystemPrivilege requires a non-empty reason for audit/debug purposes.");
  }
  return systemPrivilegeStorage.run({ reason }, fn);
}

export function getTenantOrganisationId(): string | undefined {
  return tenantAsyncStorage.getStore()?.organisationId || undefined;
}

export function getTenantUserId(): string | undefined {
  return tenantAsyncStorage.getStore()?.userId;
}

export function runWithTenantOrganisationId<T>(
  organisationId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return tenantAsyncStorage.run({ organisationId }, fn);
}

export function setTenantOrganisationId(organisationId: string): void {
  const existing = tenantAsyncStorage.getStore();
  tenantAsyncStorage.enterWith({ organisationId, userId: existing?.userId });
}

export function setTenantUserId(userId: string): void {
  const existing = tenantAsyncStorage.getStore();
  const organisationId = existing?.organisationId ?? "";
  tenantAsyncStorage.enterWith({ organisationId, userId });
}

export function clearTenantOrganisationId(): void {
  const existing = tenantAsyncStorage.getStore();
  tenantAsyncStorage.enterWith({ organisationId: "", userId: existing?.userId });
}