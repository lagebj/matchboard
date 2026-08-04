import { AsyncLocalStorage } from "async_hooks";

export type TenantContextStorage = {
  organisationId: string;
};

export const tenantAsyncStorage = new AsyncLocalStorage<TenantContextStorage>();

export function getTenantOrganisationId(): string | undefined {
  return tenantAsyncStorage.getStore()?.organisationId;
}

export function runWithTenantOrganisationId<T>(
  organisationId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return tenantAsyncStorage.run({ organisationId }, fn);
}