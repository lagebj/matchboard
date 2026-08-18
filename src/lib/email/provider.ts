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
  const baseUrl = _getAppBaseUrl();
  return baseUrl.replace(/\/+$/, "");
}