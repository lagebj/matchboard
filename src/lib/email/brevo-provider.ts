import { BrevoClient } from "@getbrevo/brevo";
import type {
  TransactionalEmailProvider,
  EmailProviderResult,
  SendEmailRequest,
} from "./provider";
import { getEmailFromAddress, getEmailFromName } from "./provider";
import { isProduction, getBrevoTestRecipients } from "@/lib/env";
import { logger } from "@/lib/logger";

export function isTestRecipientAllowed(email: string): boolean {
  if (isProduction()) return true;
  const allowlist = getBrevoTestRecipients();
  if (allowlist.size === 0) return false;
  return allowlist.has(email.toLowerCase());
}

export class BrevoEmailProvider implements TransactionalEmailProvider {
  readonly name = "brevo";
  private client: BrevoClient;

  constructor(apiKey: string) {
    this.client = new BrevoClient({ apiKey });
  }

  async send(request: SendEmailRequest): Promise<EmailProviderResult> {
    if (!isProduction()) {
      const blocked = request.to.filter((r) => !isTestRecipientAllowed(r.email));
      if (blocked.length > 0) {
        const blockedEmails = blocked.map((r) => r.email).join(", ");
        logger.warn(
          { blockedEmails },
          "[email] Blocked non-production send. Set BREVO_TEST_RECIPIENTS to allow specific addresses.",
        );
        if (blocked.length === request.to.length) {
          return {
            success: false,
            error: `Non-production environment: no test recipients configured. Set BREVO_TEST_RECIPIENTS to allow specific addresses.`,
          };
        }
      }

      const allowed = request.to.filter((r) => isTestRecipientAllowed(r.email));
      if (allowed.length === 0) {
        return {
          success: false,
          error: `Non-production environment: no test recipients configured. Set BREVO_TEST_RECIPIENTS to allow specific addresses.`,
        };
      }

      const filteredRequest: SendEmailRequest = {
        ...request,
        to: allowed,
      };

      return this._sendWithClient(filteredRequest);
    }

    return this._sendWithClient(request);
  }

  private async _sendWithClient(request: SendEmailRequest): Promise<EmailProviderResult> {
    const from = request.from ?? {
      email: getEmailFromAddress(),
      name: getEmailFromName(),
    };

    const emailRequest: Record<string, unknown> = {
      sender: { email: from.email, name: from.name ?? getEmailFromName() },
      to: request.to.map((r) => ({ email: r.email, name: r.name ?? undefined })),
      subject: request.subject,
      htmlContent: request.htmlBody,
      textContent: request.textBody,
      tags: request.tags ? Object.entries(request.tags).map(([, value]) => value) : undefined,
      headers: request.customHeaders,
    };

    if (request.replyTo) {
      emailRequest.replyTo = {
        email: request.replyTo.email,
        name: request.replyTo.name ?? undefined,
      };
    }

    try {
      const response = await this.client.transactionalEmails.sendTransacEmail(emailRequest as Parameters<typeof this.client.transactionalEmails.sendTransacEmail>[0]);

      const messageId = response?.messageId;
      if (!messageId) {
        return {
          success: false,
          error: "Brevo API returned no message ID",
        };
      }

      return {
        success: true,
        providerMessageId: String(messageId),
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unknown Brevo API error";
      return {
        success: false,
        error: message,
      };
    }
  }
}