import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { FakeMatchboardSecurityTransport } from "@/lib/ai/security-client/fake-transport";

describe("ai/security-client/fake-transport", () => {
  describe("accessCredential", () => {
    it("returns the seeded credential for a known connection", async () => {
      const transport = new FakeMatchboardSecurityTransport();
      transport.seedCredential("aic_known", "sk-secret-value");

      const result = await transport.accessCredential({ connectionId: "aic_known", accessToken: "token" });
      expect(result).toEqual({ ok: true, credential: "sk-secret-value" });
    });

    it("fails with CONNECTION_NOT_FOUND for an unseeded connection", async () => {
      const transport = new FakeMatchboardSecurityTransport();
      const result = await transport.accessCredential({ connectionId: "aic_unknown", accessToken: "token" });
      expect(result).toEqual({ ok: false, errorCode: "CONNECTION_NOT_FOUND" });
    });

    it("records every call for test assertions", async () => {
      const transport = new FakeMatchboardSecurityTransport();
      transport.seedCredential("aic_a", "cred-a");
      await transport.accessCredential({ connectionId: "aic_a", accessToken: "token-1" });

      expect(transport.accessCredentialCalls).toEqual([{ connectionId: "aic_a", accessToken: "token-1" }]);
    });

    it("forceNextAccessFailure fails exactly the next call, then reverts to normal behaviour", async () => {
      const transport = new FakeMatchboardSecurityTransport();
      transport.seedCredential("aic_a", "cred-a");
      transport.forceNextAccessFailure("PROVIDER_UNAVAILABLE");

      const first = await transport.accessCredential({ connectionId: "aic_a", accessToken: "t" });
      expect(first).toEqual({ ok: false, errorCode: "PROVIDER_UNAVAILABLE" });

      const second = await transport.accessCredential({ connectionId: "aic_a", accessToken: "t" });
      expect(second).toEqual({ ok: true, credential: "cred-a" });
    });
  });

  describe("deleteConnection", () => {
    it("deletes a seeded connection and reports status: deleted", async () => {
      const transport = new FakeMatchboardSecurityTransport();
      transport.seedCredential("aic_a", "cred-a");

      const result = await transport.deleteConnection({ connectionId: "aic_a", provider: "openai", deleteToken: "t" });
      expect(result).toEqual({ ok: true, status: "deleted" });

      const after = await transport.accessCredential({ connectionId: "aic_a", accessToken: "t" });
      expect(after).toEqual({ ok: false, errorCode: "CONNECTION_NOT_FOUND" });
    });

    it("is idempotent: deleting an already-gone connection reports status: not_found, not an error", async () => {
      const transport = new FakeMatchboardSecurityTransport();
      const result = await transport.deleteConnection({ connectionId: "aic_gone", provider: "anthropic", deleteToken: "t" });
      expect(result).toEqual({ ok: true, status: "not_found" });
    });

    it("forceNextDeleteFailure fails exactly the next call", async () => {
      const transport = new FakeMatchboardSecurityTransport();
      transport.seedCredential("aic_a", "cred-a");
      transport.forceNextDeleteFailure("SECRET_UNPROTECT_FAILED");

      const result = await transport.deleteConnection({ connectionId: "aic_a", provider: "mistral", deleteToken: "t" });
      expect(result).toEqual({ ok: false, errorCode: "SECRET_UNPROTECT_FAILED" });
    });
  });
});
