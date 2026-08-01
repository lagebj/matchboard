import { BrevoClient } from "@getbrevo/brevo";
import type {
  TransactionalEmailProvider,
  EmailProviderResult,
  SendEmailRequest,
} from "./provider";
import { getEmailFromAddress, getEmailFromName } from "./provider";

export class BrevoEmailProvider implements TransactionalEmailProvider {
  readonly name = "brevo";
  private client: BrevoClient;

  constructor(apiKey: string) {
    this.client = new BrevoClient({ apiKey });
  }

  async send(request: SendEmailRequest): Promise<EmailProviderResult> {
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
      const response = await this.client.transactionalEmails.sendTransacEmail(emailRequest as any);

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