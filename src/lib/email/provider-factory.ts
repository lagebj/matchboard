import type { TransactionalEmailProvider } from "./provider";
import { BrevoEmailProvider } from "./brevo-provider";
import { ConsoleEmailProvider } from "./console-provider";
import { getBrevoApiKey } from "@/lib/env";

let providerInstance: TransactionalEmailProvider | null = null;

export function getEmailProvider(): TransactionalEmailProvider {
  if (providerInstance) return providerInstance;

  const brevoApiKey = getBrevoApiKey();

  if (brevoApiKey) {
    providerInstance = new BrevoEmailProvider(brevoApiKey);
  } else {
    providerInstance = new ConsoleEmailProvider();
  }

  return providerInstance;
}

export function resetEmailProvider(): void {
  providerInstance = null;
}

export function setEmailProvider(provider: TransactionalEmailProvider): void {
  providerInstance = provider;
}