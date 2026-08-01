import type { TransactionalEmailProvider } from "./provider";
import { ConsoleEmailProvider } from "./console-provider";

let providerInstance: TransactionalEmailProvider | null = null;

export function getEmailProvider(): TransactionalEmailProvider {
  if (providerInstance) return providerInstance;

  const brevoApiKey = process.env.BREVO_API_KEY;

  if (brevoApiKey) {
    try {
      const { BrevoEmailProvider } = require("./brevo-provider");
      providerInstance = new BrevoEmailProvider(brevoApiKey) as TransactionalEmailProvider;
    } catch {
      console.warn("[email] Brevo SDK not available, falling back to console provider");
      providerInstance = new ConsoleEmailProvider();
    }
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