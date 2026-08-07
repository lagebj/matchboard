import { describe, it, expect, beforeEach } from "vitest";
import { setEmailProvider, resetEmailProvider, getEmailProvider } from "../provider-factory";
import { FakeEmailProvider } from "../fake-provider";

describe("provider factory", () => {
  beforeEach(() => {
    resetEmailProvider();
  });

  it("uses ConsoleEmailProvider when BREVO_API_KEY is not set", () => {
    const original = process.env.BREVO_API_KEY;
    delete process.env.BREVO_API_KEY;

    const provider = getEmailProvider();
    expect(provider.name).toBe("console");

    if (original !== undefined) {
      process.env.BREVO_API_KEY = original;
    }
  });

  it("uses BrevoEmailProvider when BREVO_API_KEY is set", () => {
    process.env.BREVO_API_KEY = "test-key";
    resetEmailProvider();

    const provider = getEmailProvider();
    expect(provider.name).toBe("brevo");

    delete process.env.BREVO_API_KEY;
  });

  it("caches the provider instance", () => {
    delete process.env.BREVO_API_KEY;

    const provider1 = getEmailProvider();
    const provider2 = getEmailProvider();
    expect(provider1).toBe(provider2);
  });

  it("allows overriding the provider via setEmailProvider", () => {
    const fake = new FakeEmailProvider();
    setEmailProvider(fake);

    const provider = getEmailProvider();
    expect(provider).toBe(fake);
  });

  it("resetEmailProvider allows re-resolving the provider", () => {
    delete process.env.BREVO_API_KEY;

    const provider1 = getEmailProvider();
    resetEmailProvider();
    const provider2 = getEmailProvider();

    expect(provider1).not.toBe(provider2);
    expect(provider2.name).toBe("console");
  });
});