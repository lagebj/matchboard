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
  const url = process.env.APP_BASE_URL ?? process.env.AUTH_URL ?? "http://localhost:3333";
  return url.replace(/\/+$/, "");
}