import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { generateKeyPair, exportPKCS8, decodeJwt } from "jose";
import { generateAiProviderConnectionId } from "@/lib/ai/connection-id";
import { FakeMatchboardSecurityTransport } from "@/lib/ai/security-client/fake-transport";
import {
  setMatchboardSecurityTransport,
  resetMatchboardSecurityTransport,
} from "@/lib/ai/security-client/transport-factory";
import { withProviderCredential, ProviderCredentialAccessError } from "@/lib/ai/credential-access";

beforeAll(async () => {
  const { privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  process.env.AI_CREDENTIAL_ACCESS_SIGNING_PRIVATE_KEY_B64 = Buffer.from(await exportPKCS8(privateKey), "utf8").toString(
    "base64",
  );
});

afterEach(() => {
  resetMatchboardSecurityTransport();
});

describe("ai/credential-access: withProviderCredential", () => {
  it("resolves the credential from the transport and passes it to fn, returning fn's result", async () => {
    const transport = new FakeMatchboardSecurityTransport();
    const connectionId = generateAiProviderConnectionId();
    transport.seedCredential(connectionId, "sk-real-secret");
    setMatchboardSecurityTransport(transport);

    const result = await withProviderCredential(connectionId, async (credential) => {
      expect(credential).toBe("sk-real-secret");
      return { insightCount: 3 };
    });

    expect(result).toEqual({ insightCount: 3 });
  });

  it("signs a real, connection-bound credential-access token and sends it to the transport", async () => {
    const transport = new FakeMatchboardSecurityTransport();
    const connectionId = generateAiProviderConnectionId();
    transport.seedCredential(connectionId, "sk-real-secret");
    setMatchboardSecurityTransport(transport);

    await withProviderCredential(connectionId, async () => "done");

    expect(transport.accessCredentialCalls).toHaveLength(1);
    const call = transport.accessCredentialCalls[0];
    expect(call.connectionId).toBe(connectionId);

    const claims = decodeJwt(call.accessToken);
    expect(claims.iss).toBe("matchboard");
    expect(claims.aud).toBe("matchboard-ai-credentials");
    expect(claims.op).toBe("access-credential");
    expect(claims.connectionId).toBe(connectionId);
  });

  it("throws ProviderCredentialAccessError, carrying the normalized error code, when the transport fails", async () => {
    const transport = new FakeMatchboardSecurityTransport();
    const connectionId = generateAiProviderConnectionId();
    // Deliberately not seeded — the transport reports CONNECTION_NOT_FOUND.
    setMatchboardSecurityTransport(transport);

    await expect(withProviderCredential(connectionId, async () => "unreachable")).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ProviderCredentialAccessError);
      expect((err as ProviderCredentialAccessError).errorCode).toBe("CONNECTION_NOT_FOUND");
      return true;
    });
  });

  it("rejects a malformed connection ID before ever calling the transport", async () => {
    const transport = new FakeMatchboardSecurityTransport();
    setMatchboardSecurityTransport(transport);

    await expect(withProviderCredential("not-a-real-id", async () => "unreachable")).rejects.toThrow(
      "Invalid AI provider connection ID",
    );
    expect(transport.accessCredentialCalls).toHaveLength(0);
  });

  it("propagates an error thrown by fn unchanged", async () => {
    const transport = new FakeMatchboardSecurityTransport();
    const connectionId = generateAiProviderConnectionId();
    transport.seedCredential(connectionId, "sk-real-secret");
    setMatchboardSecurityTransport(transport);

    await expect(
      withProviderCredential(connectionId, async () => {
        throw new Error("provider adapter blew up");
      }),
    ).rejects.toThrow("provider adapter blew up");
  });

  describe("credential-leak defence", () => {
    it("throws if the callback returns the raw credential directly", async () => {
      const transport = new FakeMatchboardSecurityTransport();
      const connectionId = generateAiProviderConnectionId();
      transport.seedCredential(connectionId, "sk-real-secret");
      setMatchboardSecurityTransport(transport);

      await expect(withProviderCredential(connectionId, async (credential) => credential)).rejects.toThrow(
        "must not include the credential",
      );
    });

    it("throws if the credential is nested inside a returned object", async () => {
      const transport = new FakeMatchboardSecurityTransport();
      const connectionId = generateAiProviderConnectionId();
      transport.seedCredential(connectionId, "sk-real-secret");
      setMatchboardSecurityTransport(transport);

      await expect(
        withProviderCredential(connectionId, async (credential) => ({
          debug: { raw: { value: credential } },
        })),
      ).rejects.toThrow("must not include the credential");
    });

    it("throws if the credential appears only as a substring of a larger string", async () => {
      const transport = new FakeMatchboardSecurityTransport();
      const connectionId = generateAiProviderConnectionId();
      transport.seedCredential(connectionId, "sk-real-secret");
      setMatchboardSecurityTransport(transport);

      await expect(
        withProviderCredential(connectionId, async (credential) => `error using key ${credential} against provider`),
      ).rejects.toThrow("must not include the credential");
    });

    it("throws if the credential is inside an array element", async () => {
      const transport = new FakeMatchboardSecurityTransport();
      const connectionId = generateAiProviderConnectionId();
      transport.seedCredential(connectionId, "sk-real-secret");
      setMatchboardSecurityTransport(transport);

      await expect(withProviderCredential(connectionId, async (credential) => [1, 2, credential])).rejects.toThrow(
        "must not include the credential",
      );
    });

    it("does not throw for unrelated return values", async () => {
      const transport = new FakeMatchboardSecurityTransport();
      const connectionId = generateAiProviderConnectionId();
      transport.seedCredential(connectionId, "sk-real-secret");
      setMatchboardSecurityTransport(transport);

      const result = await withProviderCredential(connectionId, async () => ({
        insights: [{ title: "Rotation gap", body: "P01 played every match" }],
        status: "SUCCEEDED",
      }));

      expect(result.status).toBe("SUCCEEDED");
    });

    it("does not throw or hang on a self-referencing (cyclic) return value with no leak", async () => {
      const transport = new FakeMatchboardSecurityTransport();
      const connectionId = generateAiProviderConnectionId();
      transport.seedCredential(connectionId, "sk-real-secret");
      setMatchboardSecurityTransport(transport);

      type Cyclic = { label: string; self?: Cyclic };
      const cyclic: Cyclic = { label: "safe" };
      cyclic.self = cyclic;

      await expect(withProviderCredential(connectionId, async () => cyclic)).resolves.toBe(cyclic);
    });
  });
});
