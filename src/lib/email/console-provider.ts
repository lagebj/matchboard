import type {
  TransactionalEmailProvider,
  EmailProviderResult,
  SendEmailRequest,
} from "./provider";

export class ConsoleEmailProvider implements TransactionalEmailProvider {
  readonly name = "console";

  async send(request: SendEmailRequest): Promise<EmailProviderResult> {
    console.info(
      `[email:console] To: ${request.to.map((r) => r.email).join(", ")} | Subject: ${request.subject}`,
    );
    console.info(`[email:console] Text body:\n${request.textBody}`);

    return {
      success: true,
      providerMessageId: `console-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
  }
}