import { AsyncLocalStorage } from "async_hooks";

// Mirrors src/lib/tenancy/tenant-async-storage.ts's enterWith() pattern: set once at the
// request/action boundary (requireActorContext()), read anywhere downstream in the same
// call chain without needing to thread a parameter through every function signature.

export type CorrelationContextStorage = {
  correlationId: string;
};

export const correlationAsyncStorage = new AsyncLocalStorage<CorrelationContextStorage>();

export function getCorrelationId(): string | undefined {
  return correlationAsyncStorage.getStore()?.correlationId;
}

export function setCorrelationId(correlationId: string): void {
  correlationAsyncStorage.enterWith({ correlationId });
}
