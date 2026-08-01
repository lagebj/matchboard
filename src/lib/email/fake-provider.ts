import type {
  TransactionalEmailProvider,
  EmailProviderResult,
  SendEmailRequest,
} from "./provider";

export interface CapturedEmail {
  to: string[];
  subject: string;
  htmlBody: string;
  textBody: string;
  tags?: Record<string, string>;
}

export class FakeEmailProvider implements TransactionalEmailProvider {
  readonly name = "fake";
  readonly sent: CapturedEmail[] = [];
  private nextId = 1;
  private shouldFail = false;

  failNextN(n: number): void {
    this.shouldFail = true;
    this._failCount = n;
  }

  private _failCount = 0;

  async send(request: SendEmailRequest): Promise<EmailProviderResult> {
    if (this.shouldFail && this._failCount > 0) {
      this._failCount--;
      if (this._failCount === 0) {
        this.shouldFail = false;
      }
      return {
        success: false,
        error: "FakeEmailProvider: forced failure",
      };
    }

    this.sent.push({
      to: request.to.map((r) => r.email),
      subject: request.subject,
      htmlBody: request.htmlBody,
      textBody: request.textBody,
      tags: request.tags,
    });

    return {
      success: true,
      providerMessageId: `fake-${this.nextId++}`,
    };
  }
}