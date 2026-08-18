import { getAppBaseUrl as _getAppBaseUrl, getEmailFromAddress as _getEmailFromAddress, getEmailFromName as _getEmailFromName } from "@/lib/env";

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface SendEmailRequest {
  to: EmailRecipient[];
  subject: string;
  htmlBody: string;
  textBody: string;
  from?: EmailRecipient;
  replyTo?: EmailRecipient;
  tags?: Record<string, string>;
  customHeaders?: Record<string, string>;
}

export interface EmailProviderResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface TransactionalEmailProvider {
  readonly name: string;
  send(request: SendEmailRequest): Promise<EmailProviderResult>;
}

export function getEmailFromAddress(): string {
  return _getEmailFromAddress();
}

export function getEmailFromName(): string {
  return _getEmailFromName();
}

export function getAppBaseUrl(): string {
  const centralized = _getAppBaseUrl();
  if (centralized) {
    return centralized.replace(/\/+$/, "");
  }
  // AUTH_URL is an Auth.js callback URL, not a reliable base URL for external links.
  // In production, APP_BASE_URL must be set (enforced by validateEnv).
  // This fallback exists for development/test only and may point to a
  // Vercel internal domain or a different scheme than the user-facing domain.
  const fallback = process.env.AUTH_URL ?? "http://localhost:3333";
  return fallback.replace(/\/+$/, "");
}