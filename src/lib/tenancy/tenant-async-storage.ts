import { AsyncLocalStorage } from "async_hooks";

export type TenantContextStorage = {
  organisationId: string;
  userId?: string;
};

export const tenantAsyncStorage = new AsyncLocalStorage<TenantContextStorage>();

type SystemPrivilegeStorage = {
  reason: string;
};

/**
 * A distinct AsyncLocalStorage channel (not merged into tenantAsyncStorage) for the narrow,
 * explicit escape hatch the `tenantRLS` extension (src/lib/db.ts) checks before refusing an
 * unscoped query on an RLS-scoped model. Keeping it separate from tenant context means a system
 * caller can never accidentally "look like" a real organisation (empty/placeholder orgId), and
 * grepping `runWithSystemPrivilege` finds every intentionally-unscoped call site in the repo.
 */
const systemPrivilegeStorage = new AsyncLocalStorage<SystemPrivilegeStorage>();

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