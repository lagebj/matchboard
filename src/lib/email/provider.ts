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
  return process.env.EMAIL_FROM_ADDRESS ?? "notifications@matchboard.football";
}

export function getEmailFromName(): string {
  return process.env.EMAIL_FROM_NAME ?? "Matchboard";
}

export function getAppBaseUrl(): string {
  const appBaseUrl = process.env.APP_BASE_URL;
  if (appBaseUrl) {
    return appBaseUrl.replace(/\/+$/, "");
  }
  // AUTH_URL is an Auth.js callback URL, not a reliable base URL for external links.
  // It may point to a Vercel internal domain or a different scheme than the user-facing domain.
  // In production, APP_BASE_URL must be set (enforced by validateEnv).
  // In development/test, fall back to localhost only when APP_BASE_URL is not configured.
  const fallback = process.env.AUTH_URL ?? "http://localhost:3333";
  return fallback.replace(/\/+$/, "");
}