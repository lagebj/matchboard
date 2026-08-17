import { AsyncLocalStorage } from "async_hooks";

export type TenantContextStorage = {
  organisationId: string;
  userId?: string;
};

export const tenantAsyncStorage = new AsyncLocalStorage<TenantContextStorage>();

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