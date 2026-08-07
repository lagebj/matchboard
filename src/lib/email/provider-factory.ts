import type { TransactionalEmailProvider } from "./provider";
import { BrevoEmailProvider } from "./brevo-provider";
import { ConsoleEmailProvider } from "./console-provider";

let providerInstance: TransactionalEmailProvider | null = null;

export function getEmailProvider(): TransactionalEmailProvider {
  if (providerInstance) return providerInstance;

  const brevoApiKey = process.env.BREVO_API_KEY;

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