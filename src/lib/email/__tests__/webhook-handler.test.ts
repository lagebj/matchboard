import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verifyBrevoWebhookSignature } from "../webhook-handler";

describe("verifyBrevoWebhookSignature", () => {
  it("should reject missing signature header", () => {
    const result = verifyBrevoWebhookSignature("{}", null, "test-key");
    expect(result).toBe(false);
  });

  it("should reject incorrect signature", () => {
    const result = verifyBrevoWebhookSignature("{}", "wrong-signature", "test-key");
    expect(result).toBe(false);
  });

  it("should accept correct signature", () => {
    const key = "test-webhook-key";
    const payload = '{"event":"delivered","email":"test@example.com","id":123}';
    const signature = crypto
      .createHmac("sha256", key)
      .update(payload)
      .digest("hex");

    const result = verifyBrevoWebhookSignature(payload, signature, key);
    expect(result).toBe(true);
  });

  it("should reject signature with wrong key", () => {
    const key = "correct-key";
    const payload = '{"event":"delivered"}';
    const signature = crypto
      .createHmac("sha256", key)
      .update(payload)
      .digest("hex");

    const result = verifyBrevoWebhookSignature(payload, signature, "wrong-key");
    expect(result).toBe(false);
  });
});